package com.iwr.pdv.promissorynote.application;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteCalendarDayResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteDelinquencyRangeResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteManualRequest;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentRequest;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import java.time.LocalDate;
import java.util.List;

public interface PromissoryNoteService {

    List<PromissoryNoteResponse> list(PromissoryNoteStatus status, Long customerId, LocalDate startDate, LocalDate endDate);

    List<PromissoryNoteResponse> listDueToday();

    List<PromissoryNoteCalendarDayResponse> calendarDays(LocalDate startDate, LocalDate endDate);

    List<PromissoryNoteResponse> createManual(PromissoryNoteManualRequest request, AppUser operator);

    PromissoryNoteResponse findById(Long noteId);

    PromissoryNoteResponse pay(Long noteId, PromissoryNotePaymentRequest request, AppUser operator);

    List<PromissoryNotePaymentResponse> payments(Long noteId);

    String generatePaymentReceipt(Long paymentId);

    String whatsappMessage(Long noteId, String pixKey);

    List<PromissoryNoteDelinquencyRangeResponse> delinquencyReport();

    String exportCsv(PromissoryNoteStatus status, Long customerId, LocalDate startDate, LocalDate endDate, boolean dueToday);

    String generatePrintableNote(Long noteId);

    String generatePrintableNotesForSale(Long saleId);
}
