package com.iwr.pdv.product.application;

public interface ProductBarcodeService {

    byte[] generateBarcode(String content);
}
