package com.compledger.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import io.swagger.v3.oas.models.servers.Server;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI compLedgerOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("CoMP Ledger API")
                        .version("0.1.0")
                        .description("""
                                Content Ownership and Monetization Protocol (CoMP) Ledger API.

                                Traces AI-generated answers against a publisher corpus to score the \
                                exclusivity and originality of each factual claim. Results are streamed \
                                as Server-Sent Events (SSE) so the UI can display claims as they are scored.

                                **Workflow:**
                                1. `POST /api/trace` — decompose an answer into claims and score each one (SSE)
                                2. `POST /api/export` — package the scored claims into an evidence record and write to S3
                                3. `POST /api/multi-trace` — compare answers from multiple models simultaneously (SSE)
                                """)
                        .contact(new Contact()
                                .name("CoMP Ledger")
                                .url("https://github.com/HarshilModh/comp_Ledger"))
                        .license(new License()
                                .name("MIT")))
                .servers(List.of(
                        new Server().url("http://localhost:3001").description("Local development server")
                ));
    }
}
