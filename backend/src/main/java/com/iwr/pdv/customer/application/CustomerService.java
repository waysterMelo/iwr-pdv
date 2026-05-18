package com.iwr.pdv.customer.application;

import com.iwr.pdv.customer.api.dto.CustomerRequest;
import com.iwr.pdv.customer.api.dto.CustomerPageResponse;
import com.iwr.pdv.customer.api.dto.CustomerResponse;
import java.util.List;

public interface CustomerService {

    List<CustomerResponse> list(String search);

    CustomerPageResponse listPage(String search, int page, int size);

    List<CustomerResponse> birthdays();

    CustomerResponse create(CustomerRequest request);

    CustomerResponse update(Long customerId, CustomerRequest request);
}
