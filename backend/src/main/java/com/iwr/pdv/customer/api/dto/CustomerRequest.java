package com.iwr.pdv.customer.api.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import java.math.BigDecimal;
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
        @Size(max = 140, message = "The customer street must have at most 140 characters.")
        String addressStreet,
        @Size(max = 30, message = "The customer address number must have at most 30 characters.")
        String addressNumber,
        @Size(max = 100, message = "The customer neighborhood must have at most 100 characters.")
        String addressNeighborhood,
        @Size(max = 120, message = "The customer address complement must have at most 120 characters.")
        String addressComplement,
        @Size(max = 100, message = "The customer city must have at most 100 characters.")
        String addressCity,
        @Size(max = 2, message = "The customer state must have at most 2 characters.")
        String addressState,
        @Size(max = 20, message = "The customer ZIP code must have at most 20 characters.")
        String addressZipCode,
        LocalDate birthDate,
        Boolean active,
        @Size(max = 1000, message = "The customer observations must have at most 1000 characters.")
        String observations,
        BigDecimal creditLimit
) {
}
