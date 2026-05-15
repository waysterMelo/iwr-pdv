package com.iwr.pdv.promissorynote.api.dto;

import com.iwr.pdv.auth.api.dto.UserResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteCollectionAction;
import java.time.LocalDate;
import java.time.OffsetDateTime;

public record PromissoryNoteCollectionEventResponse(
        Long id,
        PromissoryNoteCollectionAction action,
        String comment,
        LocalDate promisedPaymentDate,
        UserResponse createdBy,
        OffsetDateTime createdAt
) {
}
