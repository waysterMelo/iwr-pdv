package com.iwr.pdv.sale.application;

import com.iwr.pdv.sale.api.dto.SaleRequest;
import com.iwr.pdv.sale.api.dto.SaleResponse;
import java.time.LocalDate;
import java.util.List;

public interface SaleService {

    SaleResponse closeSale(SaleRequest request);

    List<SaleResponse> list(LocalDate startDate, LocalDate endDate);

    SaleResponse findById(Long saleId);
}
