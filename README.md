# Tây Nguyên Food

Website thương mại điện tử demo cho ASM, có giao diện HTML/CSS/JavaScript và API Node dùng CSDL SQLite tích hợp sẵn trong Node.js.

## Chạy dự án

```powershell
npm start
```

Mở `http://localhost:3000`.

Lần chạy đầu tiên, server tự tạo `data/tay-nguyen-food.sqlite` và nạp dữ liệu mẫu. Không cần cài thêm package.

## Lưu ý về CSDL khi triển khai

- Chạy bằng `npm start` để website kết nối và ghi dữ liệu thật vào SQLite.
- Nếu mở trực tiếp `index.html` hoặc đưa website lên GitHub Pages, giao diện vẫn dùng được với dữ liệu mẫu dự phòng. Biểu mẫu, newsletter và đơn hàng trong chế độ này chỉ được lưu tạm trong trình duyệt bằng `localStorage`, không ghi được vào SQLite.
- GitHub Pages phù hợp để xem giao diện tĩnh. Muốn dùng CSDL thật, hãy deploy server Node.js lên một dịch vụ hỗ trợ Node.js.

## Chức năng

- Lọc, tìm kiếm và sắp xếp sản phẩm.
- Wishlist và giỏ hàng có lưu trạng thái trên trình duyệt.
- Tăng/giảm số lượng, xoá sản phẩm và tính phí giao hàng.
- Xem nhanh sản phẩm và đặt hàng demo.
- Form liên hệ, đăng ký nhận tin và đơn hàng được lưu vào SQLite.

## API

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products?category=&q=&sort=`
- `GET /api/products/:id-or-slug`
- `GET /api/posts`
- `POST /api/contact`
- `POST /api/newsletter`
- `POST /api/orders`

## Bảng SQLite

`categories`, `products`, `posts`, `contacts`, `newsletter_subscribers`, `orders`, `order_items`.

Đặt hàng là luồng demo và chưa tích hợp cổng thanh toán thật.
