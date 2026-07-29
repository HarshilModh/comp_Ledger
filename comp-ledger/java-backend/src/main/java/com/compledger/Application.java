package com.compledger;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableAsync;

import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.IOException;

/**
 * Entry point for the CoMP Ledger Spring Boot application.
 *
 * Loads environment variables from a .env file before Spring starts,
 * so AWS credentials and model IDs are available to the application context.
 */
@SpringBootApplication
@EnableAsync
public class Application {

    public static void main(String[] args) {
        // Load .env file before Spring initialises so all @Value bindings resolve correctly
        loadDotEnv();
        SpringApplication.run(Application.class, args);
    }

    /**
     * Looks for a .env file in three candidate locations relative to the working directory
     * (for both running from the java-backend folder and from the project root).
     * Stops at the first file found and reads it line by line.
     * Each KEY=VALUE pair is set as a JVM system property, but only if the key is not
     * already present as a real OS environment variable — real env always wins.
     */
    private static void loadDotEnv() {
        String[] envPaths = {
            "../backend/.env",   // when running from java-backend/
            "../.env",           // when running from comp-ledger/
            ".env"               // when running from the project root
        };

        for (String path : envPaths) {
            File file = new File(path);
            if (file.exists()) {
                try (BufferedReader reader = new BufferedReader(new FileReader(file))) {
                    String line;
                    while ((line = reader.readLine()) != null) {
                        line = line.trim();

                        // Skip blank lines and comments
                        if (line.isEmpty() || line.startsWith("#")) {
                            continue;
                        }

                        // Find the first '=' to split key from value
                        int eqIdx = line.indexOf('=');
                        if (eqIdx < 0) {
                            continue; // malformed line with no '=', skip it
                        }

                        String key = line.substring(0, eqIdx).trim();
                        String val = line.substring(eqIdx + 1).trim();

                        // Strip surrounding quotes (single or double) from the value
                        if ((val.startsWith("\"") && val.endsWith("\"")) ||
                            (val.startsWith("'") && val.endsWith("'"))) {
                            val = val.substring(1, val.length() - 1);
                        }

                        // Only apply the value if the OS environment doesn't already define this key
                        if (System.getenv(key) == null) {
                            System.setProperty(key, val);
                        }
                    }
                    System.out.println("Loaded .env from: " + file.getAbsolutePath());
                } catch (IOException e) {
                    System.err.println("Warning: Could not read .env file at " + path + ": " + e.getMessage());
                }
                // Stop after the first .env file found
                break;
            }
        }
    }
}
