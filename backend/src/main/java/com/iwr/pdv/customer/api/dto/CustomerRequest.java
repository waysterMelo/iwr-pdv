package com.iwr.pdv.customer.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record CustomerRequest(
        @NotBlank(message = "The customer name is required.")
        @Size(max = 140, message = "The customer name must have at most 140 characters.")
        String name,
        @Size(max = 20, message = "The customer CPF must have at most 20 characters.")
        String cpf,
        @Size(max = 30, message = "The customer phone must have at most 30 characters.")
        String phone,
        @Email(message = "The customer email must be valid.")
        @Size(max = 140, message = "The customer email must have at most 140 characters.")
        String email,
        @Size(max = 240, message = "The customer address must have at most 240 characters.")
        String address,
        LocalDate birthDate,
        Boolean active
) {
}
