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
                    @page { size: 50mm 30mm; margin: 0; }
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
                      width: 50mm;
                      height: 30mm;
                      display: grid;
                      grid-template-columns: minmax(0, 1fr) 25mm;
                      gap: 2mm;
                      align-items: center;
                      padding: 2.4mm;
                      background: #fff;
                      border: 1px solid #d1d5db;
                    }
                    .content {
                      min-width: 0;
                    }
                    .brand {
                      margin: 0 0 1.1mm;
                      font-size: 6.4pt;
                      font-weight: 800;
                      letter-spacing: 0.45pt;
                      color: #4b5563;
                    }
                    .name {
                      margin: 0 0 1.3mm;
                      max-height: 8mm;
                      overflow: hidden;
                      font-size: 7.4pt;
                      line-height: 1.12;
                      font-weight: 700;
                      word-break: break-word;
                    }
                    .price {
                      margin: 0 0 1.1mm;
                      font-size: 12.4pt;
                      line-height: 1;
                      font-weight: 900;
                    }
                    .qr-frame {
                      width: 25mm;
                      height: 26mm;
                      display: grid;
                      place-items: center;
                      padding: 1mm;
                      background: #fff;
                      border: 0;
                    }
                    img {
                      width: 24mm;
                      height: 24mm;
                      display: block;
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
                    <div class="content">
                      <p class="brand">IWR MODAS</p>
                      <p class="name">%s</p>
                      <p class="price">%s</p>
                    </div>
                    <div class="qr-frame" aria-label="QR Code do produto">
                      <img src="data:image/png;base64,%s" alt="QR Code do produto">
                    </div>
                  </section>
                  <script>
                    window.addEventListener('load', () => {
                      window.focus();
                    });
                  </script>
                </body>
                </html>
                """.formatted(
                escapeHtml(product.getName()),
                escapeHtml(product.getName()),
                escapeHtml(formatCurrency(product)),
                encodedQrCode
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
