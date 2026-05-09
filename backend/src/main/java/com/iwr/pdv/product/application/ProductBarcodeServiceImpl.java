package com.iwr.pdv.product.application;

import com.google.zxing.BarcodeFormat;
import com.google.zxing.EncodeHintType;
import com.google.zxing.MultiFormatWriter;
import com.google.zxing.WriterException;
import com.google.zxing.client.j2se.MatrixToImageConfig;
import com.google.zxing.client.j2se.MatrixToImageWriter;
import com.google.zxing.common.BitMatrix;
import java.awt.Color;
import java.awt.Font;
import java.awt.FontMetrics;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;
import javax.imageio.ImageIO;
import org.springframework.stereotype.Service;

@Service
public class ProductBarcodeServiceImpl implements ProductBarcodeService {

    private static final int BARCODE_WIDTH = 800;
    private static final int BARCODE_HEIGHT = 180;
    private static final int TEXT_HEIGHT = 30;
    private static final int MARGIN = 20;

    @Override
    public byte[] generateBarcode(String content) {
        String numericContent = content.replaceAll("[^0-9]", "");

        try {
            Map<EncodeHintType, Object> hints = new HashMap<>();
            hints.put(EncodeHintType.MARGIN, 0);

            MultiFormatWriter writer = new MultiFormatWriter();
            BitMatrix bitMatrix = writer.encode(
                    numericContent,
                    BarcodeFormat.CODE_128,
                    BARCODE_WIDTH,
                    BARCODE_HEIGHT,
                    hints
            );

            MatrixToImageConfig config = new MatrixToImageConfig(
                    MatrixToImageConfig.BLACK,
                    MatrixToImageConfig.WHITE
            );
            BufferedImage barcodeOnly = MatrixToImageWriter.toBufferedImage(bitMatrix, config);

            int finalWidth = BARCODE_WIDTH + (MARGIN * 2);
            int finalHeight = BARCODE_HEIGHT + TEXT_HEIGHT + (MARGIN * 2);

            BufferedImage finalImage = new BufferedImage(finalWidth, finalHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = finalImage.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_TEXT_ANTIALIASING, RenderingHints.VALUE_TEXT_ANTIALIAS_ON);
            g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BICUBIC);

            g.setColor(Color.WHITE);
            g.fillRect(0, 0, finalWidth, finalHeight);
            g.drawImage(barcodeOnly, MARGIN, MARGIN, BARCODE_WIDTH, BARCODE_HEIGHT, null);

            g.setColor(Color.BLACK);
            g.setFont(new Font("Monospaced", Font.PLAIN, 20));
            FontMetrics fm = g.getFontMetrics();

            String displayText = formatDisplayCode(numericContent);
            int textX = (finalWidth - fm.stringWidth(displayText)) / 2;
            int textY = MARGIN + BARCODE_HEIGHT + fm.getAscent() + 4;

            g.drawString(displayText, textX, textY);
            g.dispose();

            ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
            ImageIO.write(finalImage, "PNG", outputStream);
            return outputStream.toByteArray();
        } catch (WriterException | IOException exception) {
            throw new IllegalStateException("Unable to generate product barcode.", exception);
        }
    }

    private String formatDisplayCode(String numericCode) {
        if (numericCode.length() <= 3) {
            return numericCode;
        }

        int mid = numericCode.length() / 2;
        return numericCode.substring(0, mid) + " " + numericCode.substring(mid);
    }
}
