package com.iwr.pdv.product.application;

public interface ProductQrCodeService {

    byte[] generateQrCode(String content);
}
