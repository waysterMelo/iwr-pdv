package com.iwr.pdv.common.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class OpenApiConfiguration {

    @Bean
    public OpenAPI openApi() {
        return new OpenAPI()
                .info(new Info()
                        .title("IWR PDV API")
                        .description("API de gestao da loja IWR Modas.")
                        .version("v1")
                        .contact(new Contact()
                                .name("Wayster Cruz Di Melo"))
                        .license(new License()
                                .name("Uso interno")));
    }
}
