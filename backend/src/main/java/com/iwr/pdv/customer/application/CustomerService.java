package com.iwr.pdv.customer.application;

import com.iwr.pdv.customer.api.dto.CustomerRequest;
import com.iwr.pdv.customer.api.dto.CustomerPageResponse;
import com.iwr.pdv.customer.api.dto.CustomerProfileResponse;
import com.iwr.pdv.customer.api.dto.CustomerResponse;
import com.iwr.pdv.promissorynote.domain.PromissoryNoteStatus;
import com.iwr.pdv.sale.domain.SaleStatus;
import java.time.LocalDate;
import java.util.List;

public interface CustomerService {

    List<CustomerResponse> list(String search);

    CustomerPageResponse listPage(String search, int page, int size);

    List<CustomerResponse> birthdays();

    CustomerProfileResponse profile(Long customerId);

    String exportProfileCsv(Long customerId, LocalDate startDate, LocalDate endDate, SaleStatus saleStatus, PromissoryNoteStatus noteStatus);

    CustomerResponse create(CustomerRequest request);

    CustomerResponse update(Long customerId, CustomerRequest request);
}
