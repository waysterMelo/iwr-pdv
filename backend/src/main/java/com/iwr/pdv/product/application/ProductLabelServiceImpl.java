package com.iwr.pdv.product.application;

import com.iwr.pdv.product.domain.Product;
import java.math.RoundingMode;
import java.text.NumberFormat;
import java.util.Base64;
import java.util.Locale;
import org.springframework.stereotype.Service;

@Service
public class ProductLabelServiceImpl implements ProductLabelService {

    private static final Locale BRAZIL = Locale.of("pt", "BR");

    private final ProductQrCodeService productQrCodeService;

    public ProductLabelServiceImpl(ProductQrCodeService productQrCodeService) {
        this.productQrCodeService = productQrCodeService;
    }

    @Override
    public String generateLabel(Product product) {
        String encodedQrCode = Base64.getEncoder()
                .encodeToString(productQrCodeService.generateQrCode(product.getCode()));

        return """
                <!doctype html>
                <html lang="pt-BR">
                <head>
                  <meta charset="utf-8">
                  <meta name="viewport" content="width=device-width, initial-scale=1">
                  <title>Etiqueta %s</title>
                  <style>
                    @page { size: 58mm 38mm; margin: 0; }
                    * { box-sizing: border-box; }
                    body {
                      margin: 0;
                      min-height: 100vh;
                      display: grid;
                      place-items: center;
                      background: #f3f4f6;
                      color: #111827;
                      font-family: Arial, sans-serif;
                    }
                    .label {
                      width: 58mm;
                      height: 38mm;
                      display: grid;
                      grid-template-columns: 1fr 23mm;
                      gap: 2.5mm;
                      align-items: center;
                      padding: 3mm;
                      background: #fff;
                      border: 1px solid #d1d5db;
                    }
                    .brand {
                      margin: 0 0 1.8mm;
                      font-size: 9pt;
                      font-weight: 800;
                      letter-spacing: 0.5pt;
                    }
                    .name {
                      margin: 0 0 2.2mm;
                      max-height: 12mm;
                      overflow: hidden;
                      font-size: 8pt;
                      line-height: 1.2;
                      font-weight: 700;
                    }
                    .price {
                      margin: 0 0 1.8mm;
                      font-size: 13pt;
                      line-height: 1;
                      font-weight: 900;
                    }
                    .code {
                      margin: 0;
                      font-size: 7pt;
                      letter-spacing: 0.7pt;
                      color: #374151;
                    }
                    img {
                      width: 23mm;
                      height: 23mm;
                      object-fit: contain;
                    }
                    @media print {
                      body { min-height: auto; background: #fff; }
                      .label { border: 0; }
                    }
                  </style>
                </head>
                <body>
                  <section class="label" aria-label="Etiqueta de produto">
                    <div>
                      <p class="brand">IWR MODAS</p>
                      <p class="name">%s</p>
                      <p class="price">%s</p>
                      <p class="code">%s</p>
                    </div>
                    <img src="data:image/png;base64,%s" alt="QR Code %s">
                  </section>
                  <script>
                    window.addEventListener('load', () => {
                      window.focus();
                    });
                  </script>
                </body>
                </html>
                """.formatted(
                escapeHtml(product.getCode()),
                escapeHtml(product.getName()),
                escapeHtml(formatCurrency(product)),
                escapeHtml(product.getCode()),
                encodedQrCode,
                escapeHtml(product.getCode())
        );
    }

    private String formatCurrency(Product product) {
        NumberFormat formatter = NumberFormat.getCurrencyInstance(BRAZIL);
        return formatter.format(product.getPrice().setScale(2, RoundingMode.HALF_UP));
    }

    private String escapeHtml(String value) {
        return value
                .replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&#39;");
    }
}
