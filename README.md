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

## Deploy lên Vercel

Vercel không giữ được file SQLite và không chạy `server.listen()` như server Node truyền thống. Project đã được cấu hình để Vercel deploy giao diện tĩnh, tránh lỗi `FUNCTION_INVOCATION_FAILED`:

```powershell
npm run build
```

- `vercel.json` yêu cầu Vercel build vào `public/`.
- `.vercelignore` loại `server.js` và thư mục `data/` khỏi bản deploy, nên Vercel không cố khởi chạy SQLite.
- Sau khi push nhánh `main`, Vercel tự deploy lại. Không cần thêm Environment Variable cho chế độ demo tĩnh.
- Trên Vercel, sản phẩm dùng ảnh local; giỏ hàng, đăng nhập/đăng ký và lịch sử đơn demo được lưu riêng trong `localStorage` của trình duyệt.
- Muốn dùng tài khoản, đơn hàng và SQLite thật trên production, cần deploy `server.js` lên dịch vụ Node.js có ổ đĩa bền vững, hoặc thay SQLite bằng Postgres/Supabase/Neon trước khi dùng Vercel Functions.

## Chức năng

- Lọc, tìm kiếm và sắp xếp sản phẩm.
- Wishlist và giỏ hàng có lưu trạng thái trên trình duyệt.
- Tăng/giảm số lượng, xoá toàn bộ giỏ và thông báo ngưỡng miễn phí giao hàng.
- Xem nhanh sản phẩm và đặt hàng demo.
- Đăng ký, đăng nhập, đăng xuất bằng cookie phiên khi chạy server Node.
- Xem danh sách và chi tiết đơn hàng trong tài khoản.
- Form liên hệ, đăng ký nhận tin và đơn hàng được lưu vào SQLite.

## API

- `GET /api/health`
- `GET /api/categories`
- `GET /api/products?category=&q=&sort=`
- `GET /api/products/:id-or-slug`
- `GET /api/posts`
- `GET /api/auth/me`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/orders/mine`
- `GET /api/orders/:code`
- `POST /api/contact`
- `POST /api/newsletter`
- `POST /api/orders`

## Bảng SQLite

`categories`, `products`, `posts`, `contacts`, `newsletter_subscribers`, `users`, `user_sessions`, `orders`, `order_items`.

Đặt hàng là luồng demo và chưa tích hợp cổng thanh toán thật.
