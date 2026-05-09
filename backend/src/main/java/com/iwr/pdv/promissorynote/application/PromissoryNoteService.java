package com.iwr.pdv.promissorynote.application;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentRequest;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import java.time.LocalDate;
import java.util.List;

public interface PromissoryNoteService {

    List<PromissoryNoteResponse> list(PromissoryNoteStatus status, Long customerId, LocalDate startDate, LocalDate endDate);

    List<PromissoryNoteResponse> listDueToday();

    PromissoryNoteResponse findById(Long noteId);

    PromissoryNoteResponse pay(Long noteId, PromissoryNotePaymentRequest request, AppUser operator);

    String exportCsv(PromissoryNoteStatus status, Long customerId, LocalDate startDate, LocalDate endDate);

    String generatePrintableNote(Long noteId);
}
