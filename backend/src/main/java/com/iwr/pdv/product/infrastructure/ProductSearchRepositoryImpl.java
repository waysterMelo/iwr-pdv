package com.iwr.pdv.product.infrastructure;

import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductSearchRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import jakarta.persistence.TypedQuery;
import jakarta.persistence.criteria.CriteriaBuilder;
import jakarta.persistence.criteria.CriteriaQuery;
import jakarta.persistence.criteria.Order;
import jakarta.persistence.criteria.Predicate;
import jakarta.persistence.criteria.Root;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Repository;
import org.springframework.util.StringUtils;

@Repository
public class ProductSearchRepositoryImpl implements ProductSearchRepository {

    @PersistenceContext
    private EntityManager entityManager;

    @Override
    public List<Product> findAllBySearch(String search) {
        String normalizedSearch = search == null ? "" : search.trim().toLowerCase();

        if (normalizedSearch.isBlank()) {
            return entityManager.createQuery(
                            "SELECT product FROM Product product ORDER BY product.createdAt DESC",
                            Product.class
                    )
                    .getResultList();
        }

        return entityManager.createQuery(
                        """
                        SELECT product
                        FROM Product product
                        WHERE LOWER(product.name) LIKE :search
                           OR LOWER(product.code) LIKE :search
                        ORDER BY product.createdAt DESC
                        """,
                        Product.class
                )
                .setParameter("search", "%" + normalizedSearch + "%")
                .getResultList();
    }

    @Override
    public Page<Product> findPageByFilters(
            String search,
            Boolean active,
            String stockStatus,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Long categoryId,
            int lowStockThreshold,
            Pageable pageable
    ) {
        CriteriaBuilder criteriaBuilder = entityManager.getCriteriaBuilder();
        CriteriaQuery<Product> query = criteriaBuilder.createQuery(Product.class);
        Root<Product> product = query.from(Product.class);
        List<Predicate> predicates = buildPredicates(
                criteriaBuilder,
                product,
                search,
                active,
                stockStatus,
                minPrice,
                maxPrice,
                categoryId,
                lowStockThreshold
        );

        query.select(product)
                .where(predicates.toArray(Predicate[]::new))
                .orderBy(resolveOrder(criteriaBuilder, product, pageable));

        TypedQuery<Product> typedQuery = entityManager.createQuery(query)
                .setFirstResult((int) pageable.getOffset())
                .setMaxResults(pageable.getPageSize());

        long totalElements = countProducts(
                criteriaBuilder,
                search,
                active,
                stockStatus,
                minPrice,
                maxPrice,
                categoryId,
                lowStockThreshold
        );

        return new PageImpl<>(typedQuery.getResultList(), pageable, totalElements);
    }

    private long countProducts(
            CriteriaBuilder criteriaBuilder,
            String search,
            Boolean active,
            String stockStatus,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Long categoryId,
            int lowStockThreshold
    ) {
        CriteriaQuery<Long> countQuery = criteriaBuilder.createQuery(Long.class);
        Root<Product> product = countQuery.from(Product.class);
        List<Predicate> predicates = buildPredicates(
                criteriaBuilder,
                product,
                search,
                active,
                stockStatus,
                minPrice,
                maxPrice,
                categoryId,
                lowStockThreshold
        );

        countQuery.select(criteriaBuilder.count(product))
                .where(predicates.toArray(Predicate[]::new));

        return entityManager.createQuery(countQuery).getSingleResult();
    }

    private List<Predicate> buildPredicates(
            CriteriaBuilder criteriaBuilder,
            Root<Product> product,
            String search,
            Boolean active,
            String stockStatus,
            BigDecimal minPrice,
            BigDecimal maxPrice,
            Long categoryId,
            int lowStockThreshold
    ) {
        List<Predicate> predicates = new ArrayList<>();

        if (StringUtils.hasText(search)) {
            String normalizedSearch = "%" + search.trim().toLowerCase() + "%";
            predicates.add(criteriaBuilder.or(
                    criteriaBuilder.like(criteriaBuilder.lower(product.get("name")), normalizedSearch),
                    criteriaBuilder.like(criteriaBuilder.lower(product.get("code")), normalizedSearch)
            ));
        }

        if (active != null) {
            predicates.add(criteriaBuilder.equal(product.get("active"), active));
        }

        if (minPrice != null) {
            predicates.add(criteriaBuilder.greaterThanOrEqualTo(product.get("price"), minPrice));
        }

        if (maxPrice != null) {
            predicates.add(criteriaBuilder.lessThanOrEqualTo(product.get("price"), maxPrice));
        }

        if (categoryId != null) {
            predicates.add(criteriaBuilder.equal(product.get("category").get("id"), categoryId));
        }

        if (StringUtils.hasText(stockStatus)) {
            String normalizedStockStatus = stockStatus.trim().toUpperCase();

            if ("OUT_OF_STOCK".equals(normalizedStockStatus)) {
                predicates.add(criteriaBuilder.equal(product.get("stockQuantity"), 0));
            } else if ("LOW_STOCK".equals(normalizedStockStatus)) {
                predicates.add(criteriaBuilder.between(product.get("stockQuantity"), 1, lowStockThreshold));
            } else if ("IN_STOCK".equals(normalizedStockStatus)) {
                predicates.add(criteriaBuilder.greaterThan(product.get("stockQuantity"), lowStockThreshold));
            }
        }

        return predicates;
    }

    private List<Order> resolveOrder(
            CriteriaBuilder criteriaBuilder,
            Root<Product> product,
            Pageable pageable
    ) {
        List<Order> orders = new ArrayList<>();

        for (Sort.Order order : pageable.getSort()) {
            if (order.isAscending()) {
                orders.add(criteriaBuilder.asc(product.get(order.getProperty())));
            } else {
                orders.add(criteriaBuilder.desc(product.get(order.getProperty())));
            }
        }

        if (orders.isEmpty()) {
            orders.add(criteriaBuilder.desc(product.get("createdAt")));
        }

        return orders;
    }
}
