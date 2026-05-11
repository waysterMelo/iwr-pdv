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

    private final ProductBarcodeService productBarcodeService;

    public ProductLabelServiceImpl(ProductBarcodeService productBarcodeService) {
        this.productBarcodeService = productBarcodeService;
    }

    @Override
    public String generateLabel(Product product) {
        String encodedBarcode = Base64.getEncoder()
                .encodeToString(productBarcodeService.generateBarcode(product.getCode()));

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
                      grid-template-rows: 6mm 17.8mm 4.2mm;
                      gap: 0.25mm;
                      padding: 0.5mm;
                      background: #fff;
                      border: 1px solid #d1d5db;
                    }
                    .label-header,
                    .label-footer {
                      display: flex;
                      align-items: center;
                      justify-content: space-between;
                      gap: 1mm;
                      min-width: 0;
                    }
                    .label-header {
                      justify-content: center;
                      align-items: start;
                    }
                    .name {
                      width: 100%%;
                      min-width: 0;
                      overflow: hidden;
                      display: -webkit-box;
                      font-size: 5.2pt;
                      line-height: 1.08;
                      font-weight: 700;
                      text-align: center;
                      overflow-wrap: anywhere;
                      -webkit-box-orient: vertical;
                      -webkit-line-clamp: 2;
                    }
                    .barcode-wrap {
                      display: grid;
                      place-items: center;
                      min-width: 0;
                      overflow: hidden;
                    }
                    .barcode-wrap img {
                      width: 49mm;
                      height: 17.8mm;
                      display: block;
                      object-fit: fill;
                      image-rendering: crisp-edges;
                    }
                    .code {
                      flex: 1 1 auto;
                      min-width: 0;
                      overflow: hidden;
                      font-size: 6pt;
                      line-height: 1;
                      font-weight: 800;
                      white-space: nowrap;
                    }
                    .price {
                      flex: 0 0 auto;
                      font-size: 10.5pt;
                      line-height: 1;
                      font-weight: 900;
                    }
                    p { margin: 0; }
                    @media print {
                      body { min-height: auto; background: #fff; }
                      .label { border: 0; break-after: page; }
                    }
                  </style>
                </head>
                <body>
                  <section class="label" aria-label="Etiqueta de produto">
                    <header class="label-header">
                      <p class="name">%s</p>
                    </header>
                    <div class="barcode-wrap" aria-label="Codigo de barras do produto">
                      <img src="data:image/png;base64,%s" alt="Codigo de barras do produto">
                    </div>
                    <footer class="label-footer">
                      <p class="code">%s</p>
                      <p class="price">%s</p>
                    </footer>
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
                encodedBarcode,
                escapeHtml(product.getCode()),
                escapeHtml(formatCurrency(product))
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
