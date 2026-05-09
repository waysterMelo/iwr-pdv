package com.iwr.pdv.promissorynote.api.dto;

import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import java.math.BigDecimal;
import java.time.LocalDate;

public record PromissoryNoteSummaryResponse(
        Long id,
        Integer installmentNumber,
        Integer totalInstallments,
        BigDecimal amount,
        LocalDate dueDate,
        PromissoryNoteStatus status
) {
}
