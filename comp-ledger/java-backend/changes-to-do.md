# Switching from DynamoDB to PostgreSQL

This guide covers how to replace the DynamoDB-backed publisher repository with PostgreSQL (Spring Data JPA).

---

## Step 1: Add dependencies to `pom.xml`

Add these inside `<dependencies>`:

```xml
<dependency>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-data-jpa</artifactId>
</dependency>

<dependency>
    <groupId>org.postgresql</groupId>
    <artifactId>postgresql</artifactId>
    <scope>runtime</scope>
</dependency>
```

You can optionally remove the DynamoDB dependencies if you no longer need them:

```xml
<!-- Remove these -->
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>dynamodb</artifactId>
</dependency>
<dependency>
    <groupId>software.amazon.awssdk</groupId>
    <artifactId>dynamodb-enhanced</artifactId>
</dependency>
```

---

## Step 2: Add Postgres configuration to `application.properties`

```properties
# PostgreSQL
spring.datasource.url=${DATABASE_URL:jdbc:postgresql://localhost:5432/comp_ledger}
spring.datasource.username=${DB_USERNAME:comp}
spring.datasource.password=${DB_PASSWORD:comp_dev}
spring.jpa.hibernate.ddl-auto=update
spring.jpa.properties.hibernate.dialect=org.hibernate.dialect.PostgreSQLDialect
```

Remove or comment out:

```properties
# dynamodb.publishers-table=${PUBLISHERS_TABLE:comp-ledger-publishers}
```

---

## Step 3: Create a JPA entity

Create `src/main/java/com/compledger/model/PublisherEntity.java`:

```java
package com.compledger.model;

import jakarta.persistence.*;
import java.time.Instant;

@Entity
@Table(name = "publishers")
public class PublisherEntity {

    @Id
    private String id;

    @Column(nullable = false)
    private String name;

    @Column(nullable = false, unique = true)
    private String email;

    @Column(name = "api_key", nullable = false, unique = true)
    private String apiKey;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    // Getters and setters (same as Publisher.java)

    public Publisher toModel() {
        return new Publisher(id, name, email, apiKey, createdAt);
    }

    public static PublisherEntity fromModel(Publisher p) {
        PublisherEntity e = new PublisherEntity();
        e.id = p.getId();
        e.name = p.getName();
        e.email = p.getEmail();
        e.apiKey = p.getApiKey();
        e.createdAt = p.getCreatedAt();
        return e;
    }
}
```

---

## Step 4: Create a Spring Data JPA repository interface

Create `src/main/java/com/compledger/repository/JpaPublisherDataRepository.java`:

```java
package com.compledger.repository;

import com.compledger.model.PublisherEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface JpaPublisherDataRepository extends JpaRepository<PublisherEntity, String> {
    Optional<PublisherEntity> findByApiKey(String apiKey);
    Optional<PublisherEntity> findByEmail(String email);
}
```

---

## Step 5: Create the PostgreSQL implementation of `PublisherRepository`

Create `src/main/java/com/compledger/repository/JpaPublisherRepository.java`:

```java
package com.compledger.repository;

import com.compledger.model.Publisher;
import com.compledger.model.PublisherEntity;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public class JpaPublisherRepository implements PublisherRepository {

    private final JpaPublisherDataRepository jpaRepo;

    public JpaPublisherRepository(JpaPublisherDataRepository jpaRepo) {
        this.jpaRepo = jpaRepo;
    }

    @Override
    public Publisher save(Publisher publisher) {
        jpaRepo.save(PublisherEntity.fromModel(publisher));
        return publisher;
    }

    @Override
    public Optional<Publisher> findById(String id) {
        return jpaRepo.findById(id).map(PublisherEntity::toModel);
    }

    @Override
    public Optional<Publisher> findByApiKey(String apiKey) {
        return jpaRepo.findByApiKey(apiKey).map(PublisherEntity::toModel);
    }

    @Override
    public Optional<Publisher> findByEmail(String email) {
        return jpaRepo.findByEmail(email).map(PublisherEntity::toModel);
    }

    @Override
    public void deleteById(String id) {
        jpaRepo.deleteById(id);
    }
}
```

---

## Step 6: Remove or disable the DynamoDB implementation

Either delete `DynamoPublisherRepository.java`, or gate it with a profile/property:

```java
@Repository
@ConditionalOnProperty(name = "publisher.storage", havingValue = "dynamodb")
public class DynamoPublisherRepository implements PublisherRepository {
    // ...
}
```

And on the JPA version:

```java
@Repository
@ConditionalOnProperty(name = "publisher.storage", havingValue = "postgres", matchIfMissing = true)
public class JpaPublisherRepository implements PublisherRepository {
    // ...
}
```

Then control via `application.properties`:

```properties
publisher.storage=postgres
```

---

## Step 7: Remove the DynamoDbClient bean (optional)

In `config/AwsConfig.java`, remove or conditionally disable:

```java
@Bean
@ConditionalOnProperty(name = "publisher.storage", havingValue = "dynamodb")
public DynamoDbClient dynamoDbClient() { ... }
```

---

## What stays the same

These files require zero changes:

- `PublisherRepository.java` (interface)
- `PublisherService.java` (depends only on the interface)
- `PublisherController.java` (depends only on the service)
- `ApiKeyFilter.java` (depends only on the service)

This is the benefit of the repository interface pattern — the entire auth and account system is decoupled from the storage engine.
