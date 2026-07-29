package com.compledger.service;

import com.compledger.model.Publisher;
import com.compledger.repository.PublisherRepository;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Service
public class PublisherService {

    private final PublisherRepository publisherRepository;

    public PublisherService(PublisherRepository publisherRepository) {
        this.publisherRepository = publisherRepository;
    }

    public Publisher register(String name, String email) {
        Optional<Publisher> existing = publisherRepository.findByEmail(email);
        if (existing.isPresent()) {
            throw new IllegalArgumentException("A publisher with this email already exists");
        }

        Publisher publisher = new Publisher();
        publisher.setId(UUID.randomUUID().toString());
        publisher.setName(name);
        publisher.setEmail(email);
        publisher.setApiKey(generateApiKey());
        publisher.setCreatedAt(Instant.now());

        return publisherRepository.save(publisher);
    }

    public Optional<Publisher> authenticate(String apiKey) {
        if (apiKey == null || apiKey.isBlank()) return Optional.empty();
        return publisherRepository.findByApiKey(apiKey);
    }

    public Optional<Publisher> getById(String id) {
        return publisherRepository.findById(id);
    }

    public String regenerateApiKey(String publisherId) {
        Publisher publisher = publisherRepository.findById(publisherId)
                .orElseThrow(() -> new IllegalArgumentException("Publisher not found"));
        publisher.setApiKey(generateApiKey());
        publisherRepository.save(publisher);
        return publisher.getApiKey();
    }

    private String generateApiKey() {
        return "cl_" + UUID.randomUUID().toString().replace("-", "");
    }
}
