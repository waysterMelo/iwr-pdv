package com.iwr.pdv.promissorynote.api.dto;

import com.iwr.pdv.promissorynote.domain.PromissoryNoteCollectionAction;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import java.time.LocalDate;

public record PromissoryNoteCollectionEventRequest(
        @NotNull(message = "The collection action is required.")
        PromissoryNoteCollectionAction action,

        @Size(max = 500, message = "The collection comment must contain at most 500 characters.")
        String comment,

        LocalDate promisedPaymentDate
) {
}
