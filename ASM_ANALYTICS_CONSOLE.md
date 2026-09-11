# Tây Nguyên Food - Analytics và Search Console

Tài liệu này dùng làm minh chứng cho mục 3.3 và Chương V trong ASM. Không tự bịa số liệu; mọi chỉ số GA4, Search Console, PageSpeed và ranking phải lấy từ website đã deploy.

## Thông Tin Website

| Hạng mục | Nội dung |
| --- | --- |
| Google Sites | https://sites.google.com/view/is425-taynguyenfood/ |
| Website Vercel | https://is-425.vercel.app |
| Sitemap Vercel | https://is-425.vercel.app/sitemap.xml |
| Robots Vercel | https://is-425.vercel.app/robots.txt |
| GA4 Measurement ID | G-4V342G0452 |
| Email | hello@taynguyenfood.vn |
| Hotline | 090 123 4567 |
| Địa chỉ | 12 Nguyễn Tất Thành, Buôn Ma Thuột, Đắk Lắk |

## Link Lọc Sản Phẩm Từ Google Sites

| Nút trên Google Sites | Link mở sang Vercel | Kết quả cần thấy |
| --- | --- | --- |
| Cà phê Tây Nguyên | `https://is-425.vercel.app/products?category=coffee` | Chip Cà phê active, hiển thị 3 sản phẩm cà phê |
| Mắc ca | `https://is-425.vercel.app/products?category=nuts` | Chip Mắc ca active |
| Mật ong | `https://is-425.vercel.app/products?category=honey` | Chip Mật ong active |
| Sầu riêng | `https://is-425.vercel.app/products?category=durian` | Chip Sầu riêng active |
| Tiêu | `https://is-425.vercel.app/products?category=pepper` | Chip Tiêu active, có sản phẩm tiêu đen |
| Đặc sản khô | `https://is-425.vercel.app/products?category=dry` | Có bò một nắng và măng khô |
| Quà tặng | `https://is-425.vercel.app/products?category=gift` | Hiển thị combo quà tặng |

## 3.3.1 Khai Báo Google Search Console

1. Vào https://search.google.com/search-console.
2. Chọn property Google Sites: `https://sites.google.com/view/is425-taynguyenfood/`.
3. Kiểm tra trạng thái xác minh bằng Google Analytics.
4. Chụp màn hình phần Tổng quan hoặc Cài đặt xác minh để chứng minh website đã được xác minh.

Ghi chú ASM đề xuất:

> Website Tây Nguyên Food đã được xác minh quyền sở hữu trên Google Search Console bằng Google Analytics. Do website mới triển khai, dữ liệu hiệu suất tìm kiếm cần thời gian để Google thu thập và lập chỉ mục.

## 3.3.2 Submit Sitemap Và URL

1. Trong Search Console, vào Sơ đồ trang web.
2. Với Vercel, submit `https://is-425.vercel.app/sitemap.xml`.
3. Với Google Sites, dùng Kiểm tra URL cho `https://sites.google.com/view/is425-taynguyenfood/`.
4. Bấm Yêu cầu lập chỉ mục cho các trang chính: Trang chủ, Sản phẩm, Tin tức, Liên hệ.
5. Chụp màn hình trạng thái sitemap, trạng thái URL và ngày kiểm tra gần nhất.

## Cách Tạo Dữ Liệu Thật Nhanh Hơn

Search Console không thể tự tạo số ngay vì chỉ ghi nhận dữ liệu từ Google Search. Để có minh chứng chuyên nghiệp mà vẫn thật:

| Việc cần làm | Công cụ ghi nhận | Ảnh cần chụp |
| --- | --- | --- |
| Mở website trên nhiều thiết bị thật | GA4 Realtime | Users trong 30 phút gần nhất |
| Bấm danh mục từ Google Sites sang Vercel | GA4 Events | `open_filtered_products`, `select_product_category` |
| Bấm xem chi tiết sản phẩm | GA4 Events | `view_item` |
| Thêm sản phẩm vào giỏ | GA4 Events | `add_to_cart` |
| Chia sẻ link lên nhóm lớp/fanpage | GA4 Acquisition | Source/medium |
| Submit URL trong Search Console | Search Console | URL inspection và Indexing request |

## Bảng Minh Chứng Cần Chụp

| Công cụ | Chỉ số cần chụp | Đưa vào ASM |
| --- | --- | --- |
| GA4 Realtime | Users trong 30 phút gần nhất | Chứng minh đã cài tracking |
| GA4 Events | `open_filtered_products`, `select_product_category`, `view_item`, `add_to_cart` | Chứng minh có tương tác sản phẩm |
| GA4 Reports | Users, New users, Engagement time | Chương V - Google Analytics |
| GA4 Acquisition | Session source / medium | Phân tích nguồn truy cập |
| GA4 Pages and screens | Trang được xem nhiều | Đánh giá nội dung website |
| Search Console Performance | Impressions, Clicks, CTR, Average position | Chương V - SEO performance |
| Search Console Pages | Trang được Google ghi nhận | Đánh giá lập chỉ mục |
| Search Console Sitemaps | Trạng thái sitemap | Minh chứng submit sitemap |

## Bảng Trạng Thái Search Console Cho ASM

| Chỉ số | Trạng thái hiện tại | Cách diễn giải |
| --- | --- | --- |
| Clicks | Chờ dữ liệu thật | Website mới xác minh nên chưa có lượt nhấp từ Google |
| Impressions | Chờ dữ liệu thật | Google cần thời gian index và hiển thị kết quả |
| CTR | Chờ dữ liệu thật | Chỉ có khi đã có impressions |
| Average Position | Chờ dữ liệu thật | Chỉ có khi website bắt đầu xuất hiện theo query |
| Indexed pages | Kiểm tra bằng URL Inspection | Chụp ảnh từng URL được yêu cầu lập chỉ mục |

## Plugin / Công Cụ Nên Liệt Kê Trong ASM

| Plugin / công cụ | Ảnh minh chứng | Vai trò |
| --- | --- | --- |
| Google Analytics 4 | Realtime, Events, Reports | Đo users, new users, engagement, traffic source, device |
| Google Search Console | Performance, Pages, Sitemaps | Đo impressions, clicks, CTR, ranking, indexed pages |
| PageSpeed Insights | Điểm mobile và desktop | Đánh giá tốc độ tải trang |
| SEOquake | Audit on-page | Kiểm tra title, meta, heading, internal link |
| Screaming Frog | Crawl report | Kiểm tra URL, status code, title, meta, H1 |

## Ghi Chú Nộp Bài

- Không điền các số như 350 users, 1.200 impressions hoặc Top 10 nếu chưa có ảnh minh chứng.
- Nếu Search Console còn 0, ghi rõ ngày xác minh, ngày submit URL và thời gian chờ Google thu thập.
- Dùng GA4 Realtime và Events để có số liệu tương tác thật trong ngày demo.
