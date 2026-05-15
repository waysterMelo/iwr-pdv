package com.iwr.pdv.promissorynote.api.dto;

import java.math.BigDecimal;

public record PromissoryNoteDelinquencyRangeResponse(
        String range,
        BigDecimal amount,
        long count
) {
}
