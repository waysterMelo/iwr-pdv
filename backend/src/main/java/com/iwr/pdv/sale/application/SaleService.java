package com.iwr.pdv.sale.application;

import com.iwr.pdv.auth.domain.AppUser;
import com.iwr.pdv.sale.api.dto.SaleCancellationRequest;
import com.iwr.pdv.sale.api.dto.SaleRequest;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import java.time.LocalDate;
import java.util.List;

public interface SaleService {

    SaleResponse closeSale(SaleRequest request, AppUser operator);

    SaleResponse cancel(Long saleId, SaleCancellationRequest request, AppUser operator);

    List<SaleResponse> list(LocalDate startDate, LocalDate endDate);

    SaleResponse findById(Long saleId);

    String generateReceipt(Long saleId);
}
