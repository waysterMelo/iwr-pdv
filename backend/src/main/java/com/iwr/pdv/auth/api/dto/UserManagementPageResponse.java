package com.iwr.pdv.auth.api.dto;

import java.util.List;

public record UserManagementPageResponse(
        List<UserManagementResponse> content,
        int page,
        int size,
        long totalElements,
        int totalPages,
        boolean first,
        boolean last
) {
}
