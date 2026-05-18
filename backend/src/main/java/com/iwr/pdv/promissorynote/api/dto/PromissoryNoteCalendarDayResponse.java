package com.iwr.pdv.promissorynote.api.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record PromissoryNoteCalendarDayResponse(
        LocalDate date,
        BigDecimal amount,
        long count
) {
}
