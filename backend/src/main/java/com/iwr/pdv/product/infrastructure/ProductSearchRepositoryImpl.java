package com.iwr.pdv.product.infrastructure;

import com.iwr.pdv.product.domain.Product;
import com.iwr.pdv.product.domain.ProductSearchRepository;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import java.util.List;
import org.springframework.stereotype.Repository;

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
}
