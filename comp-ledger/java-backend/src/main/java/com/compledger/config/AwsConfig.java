package com.compledger.config;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import software.amazon.awssdk.regions.Region;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeAsyncClient;
import software.amazon.awssdk.services.bedrockruntime.BedrockRuntimeClient;
import software.amazon.awssdk.services.dynamodb.DynamoDbClient;
import software.amazon.awssdk.services.s3.S3Client;

/**
 * Produces AWS SDK client beans shared across the application.
 * The AWS region is read from the aws.region property (defaults to us-east-1).
 * Credentials are resolved automatically by the AWS Default Credential Provider
 * Chain (env vars, ~/.aws/credentials, IAM role, etc.) — no explicit config needed.
 */
@Configuration
public class AwsConfig {

    /** AWS region read from application.properties / .env (e.g. "us-east-1") */
    @Value("${aws.region}")
    private String awsRegion;

    /**
     * Synchronous Bedrock client used directly by EmbedService to call
     * the Titan embedding model with custom parameters (dimensions, normalize)
     * that Spring AI's embedding abstraction does not expose.
     */
    @Bean
    public BedrockRuntimeClient bedrockRuntimeClient() {
        return BedrockRuntimeClient.builder()
                .region(Region.of(awsRegion))
                .build();
    }

    /**
     * Asynchronous Bedrock client required by Spring AI's BedrockProxyChatModel
     * for streaming responses. Even though we use blocking .call() in our services,
     * Spring AI's auto-configuration expects this bean to exist.
     */
    @Bean
    public BedrockRuntimeAsyncClient bedrockRuntimeAsyncClient() {
        return BedrockRuntimeAsyncClient.builder()
                .region(Region.of(awsRegion))
                .build();
    }

    /**
     * S3 client used by S3Service to write immutable evidence records.
     */
    @Bean
    public S3Client s3Client() {
        return S3Client.builder()
                .region(Region.of(awsRegion))
                .build();
    }

    /**
     * DynamoDB client used by PublisherRepository for account storage.
     * To switch to PostgreSQL: remove this bean and replace DynamoPublisherRepository
     * with a JPA-based implementation.
     */
    @Bean
    public DynamoDbClient dynamoDbClient() {
        return DynamoDbClient.builder()
                .region(Region.of(awsRegion))
                .build();
    }
}
