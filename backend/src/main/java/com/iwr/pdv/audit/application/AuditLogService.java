package com.iwr.pdv.audit.application;

import com.iwr.pdv.audit.api.dto.AuditLogPageResponse;
import com.iwr.pdv.audit.api.dto.AuditLogResponse;
import com.iwr.pdv.audit.domain.AuditAction;
import com.iwr.pdv.audit.domain.AuditLog;
import com.iwr.pdv.audit.domain.AuditLogRepository;
import com.iwr.pdv.auth.domain.AppUser;
import jakarta.persistence.criteria.Predicate;
import java.time.Clock;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

@Service
public class AuditLogService {

    private final AuditLogRepository auditLogRepository;
    private final Clock clock;

    public AuditLogService(AuditLogRepository auditLogRepository, Clock clock) {
        this.auditLogRepository = auditLogRepository;
        this.clock = clock;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void log(AuditAction action, AppUser user, String entityType, Object entityId, String details) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUser(user);
        auditLog.setUsername(user == null ? null : user.getUsername());
        auditLog.setAction(action);
        auditLog.setEntityType(normalize(entityType, 80));
        auditLog.setEntityId(entityId == null ? null : normalize(String.valueOf(entityId), 80));
        auditLog.setDetails(normalize(details, 1000));
        auditLog.setOccurredAt(OffsetDateTime.now(clock));

        auditLogRepository.save(auditLog);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void logAnonymous(AuditAction action, String username, String entityType, Object entityId, String details) {
        AuditLog auditLog = new AuditLog();
        auditLog.setUsername(normalize(username, 80));
        auditLog.setAction(action);
        auditLog.setEntityType(normalize(entityType, 80));
        auditLog.setEntityId(entityId == null ? null : normalize(String.valueOf(entityId), 80));
        auditLog.setDetails(normalize(details, 1000));
        auditLog.setOccurredAt(OffsetDateTime.now(clock));

        auditLogRepository.save(auditLog);
    }

    @Transactional(readOnly = true)
    public AuditLogPageResponse list(
            OffsetDateTime startDate,
            OffsetDateTime endDate,
            String username,
            AuditAction action,
            String entityType,
            int page,
            int size
    ) {
        String normalizedUsername = username == null || username.isBlank() ? null : username.trim();
        String normalizedEntityType = entityType == null || entityType.isBlank() ? null : entityType.trim().toUpperCase();

        Page<AuditLog> auditPage = auditLogRepository.findAll(
                buildSpecification(startDate, endDate, normalizedUsername, action, normalizedEntityType),
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "occurredAt"))
        );

        List<AuditLogResponse> content = auditPage.getContent()
                .stream()
                .map(this::toResponse)
                .toList();

        return new AuditLogPageResponse(
                content,
                auditPage.getNumber(),
                auditPage.getSize(),
                auditPage.getTotalElements(),
                auditPage.getTotalPages(),
                auditPage.isFirst(),
                auditPage.isLast()
        );
    }

    private Specification<AuditLog> buildSpecification(
            OffsetDateTime startDate,
            OffsetDateTime endDate,
            String username,
            AuditAction action,
            String entityType
    ) {
        return (root, query, criteriaBuilder) -> {
            List<Predicate> predicates = new ArrayList<>();

            if (startDate != null) {
                predicates.add(criteriaBuilder.greaterThanOrEqualTo(root.get("occurredAt"), startDate));
            }

            if (endDate != null) {
                predicates.add(criteriaBuilder.lessThanOrEqualTo(root.get("occurredAt"), endDate));
            }

            if (username != null) {
                predicates.add(criteriaBuilder.like(
                        criteriaBuilder.lower(root.get("username")),
                        "%" + username.toLowerCase() + "%"
                ));
            }

            if (action != null) {
                predicates.add(criteriaBuilder.equal(root.get("action"), action));
            }

            if (entityType != null) {
                predicates.add(criteriaBuilder.equal(root.get("entityType"), entityType));
            }

            return criteriaBuilder.and(predicates.toArray(Predicate[]::new));
        };
    }

    private AuditLogResponse toResponse(AuditLog auditLog) {
        return new AuditLogResponse(
                auditLog.getId(),
                auditLog.getUser() == null ? null : auditLog.getUser().getId(),
                auditLog.getUsername(),
                auditLog.getUser() == null ? null : auditLog.getUser().getDisplayName(),
                auditLog.getAction(),
                auditLog.getEntityType(),
                auditLog.getEntityId(),
                auditLog.getDetails(),
                auditLog.getOccurredAt()
        );
    }

    private String normalize(String value, int maxLength) {
        if (value == null || value.isBlank()) {
            return null;
        }

        String trimmed = value.trim();
        return trimmed.length() <= maxLength ? trimmed : trimmed.substring(0, maxLength);
    }
}
