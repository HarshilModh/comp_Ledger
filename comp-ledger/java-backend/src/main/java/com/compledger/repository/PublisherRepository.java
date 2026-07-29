package com.compledger.repository;

import com.compledger.model.Publisher;

import java.util.Optional;

/**
 * Persistence abstraction for publisher accounts.
 *
 * To switch from DynamoDB to PostgreSQL:
 *   1. Add spring-boot-starter-data-jpa and a Postgres driver to pom.xml
 *   2. Create a JpaPublisherRepository implementing this interface
 *   3. Remove or @ConditionalOnProperty-gate the DynamoPublisherRepository bean
 *   4. The rest of the application remains unchanged
 */
public interface PublisherRepository {

    Publisher save(Publisher publisher);

    Optional<Publisher> findById(String id);

    Optional<Publisher> findByApiKey(String apiKey);

    Optional<Publisher> findByEmail(String email);

    void deleteById(String id);
}
