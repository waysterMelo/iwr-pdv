package com.iwr.pdv.promissorynote.api;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteCalendarDayResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteDelinquencyRangeResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteManualRequest;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentRequest;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNotePaymentResponse;
import com.iwr.pdv.promissorynote.api.dto.PromissoryNoteResponse;
import com.iwr.pdv.promissorynote.application.PromissoryNoteService;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import java.time.LocalDate;
import java.util.List;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/promissory-notes")
@Tag(name = "Promissory Notes", description = "Promissory note tracking, printing and settlement.")
public class PromissoryNoteController {

    private final PromissoryNoteService promissoryNoteService;

    public PromissoryNoteController(PromissoryNoteService promissoryNoteService) {
        this.promissoryNoteService = promissoryNoteService;
    }

    @GetMapping
    @Operation(summary = "List promissory notes")
    public List<PromissoryNoteResponse> list(
            @RequestParam(required = false) PromissoryNoteStatus status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return promissoryNoteService.list(status, customerId, startDate, endDate);
    }

    @GetMapping("/due-today")
    @Operation(summary = "List unpaid promissory notes due today or overdue")
    public List<PromissoryNoteResponse> listDueToday() {
        return promissoryNoteService.listDueToday();
    }

    @GetMapping("/calendar-days")
    @Operation(summary = "Return open promissory notes grouped by due date")
    public List<PromissoryNoteCalendarDayResponse> calendarDays(
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate
    ) {
        return promissoryNoteService.calendarDays(startDate, endDate);
    }

    @PostMapping("/manual")
    @Operation(summary = "Create promissory notes without a sale")
    public List<PromissoryNoteResponse> createManual(
            @Valid @RequestBody PromissoryNoteManualRequest request,
            HttpServletRequest servletRequest
    ) {
        return promissoryNoteService.createManual(request, currentUser(servletRequest));
    }

    @GetMapping("/{noteId}")
    @Operation(summary = "Find promissory note by id")
    public PromissoryNoteResponse findById(@PathVariable Long noteId) {
        return promissoryNoteService.findById(noteId);
    }

    @PostMapping("/{noteId}/payments")
    @Operation(summary = "Settle a promissory note payment")
    public PromissoryNoteResponse pay(
            @PathVariable Long noteId,
            @Valid @RequestBody PromissoryNotePaymentRequest request,
            HttpServletRequest servletRequest
    ) {
        return promissoryNoteService.pay(noteId, request, currentUser(servletRequest));
    }

    @GetMapping("/{noteId}/payments")
    @Operation(summary = "List payments registered for a promissory note")
    public List<PromissoryNotePaymentResponse> payments(@PathVariable Long noteId) {
        return promissoryNoteService.payments(noteId);
    }

    @GetMapping(value = "/payments/{paymentId}/receipt", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Generate a payment receipt")
    public ResponseEntity<String> paymentReceipt(@PathVariable Long paymentId) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(promissoryNoteService.generatePaymentReceipt(paymentId));
    }

    @GetMapping("/{noteId}/whatsapp-message")
    @Operation(summary = "Generate a WhatsApp collection message")
    public String whatsappMessage(
            @PathVariable Long noteId,
            @RequestParam(required = false) String pixKey
    ) {
        return promissoryNoteService.whatsappMessage(noteId, pixKey);
    }

    @GetMapping("/delinquency-report")
    @Operation(summary = "Return overdue receivables grouped by delay range")
    public List<PromissoryNoteDelinquencyRangeResponse> delinquencyReport() {
        return promissoryNoteService.delinquencyReport();
    }

    @GetMapping(value = "/export.csv", produces = "text/csv")
    @Operation(summary = "Export promissory notes as an Excel-compatible report")
    public ResponseEntity<String> exportCsv(
            @RequestParam(required = false) PromissoryNoteStatus status,
            @RequestParam(required = false) Long customerId,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate startDate,
            @RequestParam(required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate endDate,
            @RequestParam(required = false, defaultValue = "false") boolean dueToday
    ) {
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=relatorio-excel-notas-promissorias.csv")
                .contentType(MediaType.parseMediaType("text/csv; charset=utf-8"))
                .body("\uFEFF" + promissoryNoteService.exportCsv(status, customerId, startDate, endDate, dueToday));
    }

    @GetMapping(value = "/{noteId}/print", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Generate printable promissory note")
    public ResponseEntity<String> print(@PathVariable Long noteId) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(promissoryNoteService.generatePrintableNote(noteId));
    }

    @GetMapping(value = "/sale/{saleId}/print", produces = MediaType.TEXT_HTML_VALUE)
    @Operation(summary = "Generate printable promissory notes for a sale")
    public ResponseEntity<String> printBySale(@PathVariable Long saleId) {
        return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(promissoryNoteService.generatePrintableNotesForSale(saleId));
    }

    private AppUser currentUser(HttpServletRequest request) {
        return (AppUser) request.getAttribute("authenticatedUser");
    }
}
