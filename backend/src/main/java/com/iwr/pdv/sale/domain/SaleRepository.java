package com.iwr.pdv.sale.domain;

import com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardTopProductResponse;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface SaleRepository extends JpaRepository<Sale, Long> {

    @EntityGraph(attributePaths = {"items", "operator", "customer"})
    List<Sale> findBySoldAtBetweenOrderBySoldAtDesc(OffsetDateTime start, OffsetDateTime end);

    @EntityGraph(attributePaths = {"items", "operator", "cashRegister", "customer"})
    List<Sale> findByCashRegisterIdAndStatus(Long cashRegisterId, SaleStatus status);

    @EntityGraph(attributePaths = {"items", "operator", "customer"})
    List<Sale> findAllByOrderBySoldAtDesc();

    @EntityGraph(attributePaths = {"items", "operator", "customer"})
    List<Sale> findByCustomerIdOrderBySoldAtDesc(Long customerId);

    @Override
    @EntityGraph(attributePaths = {"items", "operator", "customer"})
    Optional<Sale> findById(Long id);

    @Query("select coalesce(sum(item.quantity * product.costPrice), 0) " +
           "from SaleItem item " +
           "join item.product product " +
           "join item.sale sale " +
           "where sale.status = 'COMPLETED' " +
           "and sale.soldAt between :start and :end")
    BigDecimal sumCMVForPeriod(@Param("start") OffsetDateTime start, @Param("end") OffsetDateTime end);

    @Query("select new com.iwr.pdv.admin.dashboard.api.dto.AdminDashboardTopProductResponse(" +
           "item.productName, item.productCode, sum(item.quantity), sum(item.subtotal)) " +
           "from SaleItem item " +
           "join item.sale sale " +
           "where sale.status = 'COMPLETED' " +
           "and sale.soldAt between :start and :end " +
           "group by item.productCode, item.productName " +
           "order by sum(item.quantity) desc")
    List<AdminDashboardTopProductResponse> findTopProductsForPeriod(
            @Param("start") OffsetDateTime start,
            @Param("end") OffsetDateTime end,
            Pageable pageable
    );
}
