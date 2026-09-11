# Tay Nguyen Food - Analytics va Search Console

Tai lieu nay dung de lam minh chung cho muc 3.3 va Chuong V trong ASM. Khong tu bia so lieu; tat ca chi so GA4, Search Console, PageSpeed va ranking phai chup tu website da deploy.

## Thong tin website

| Hang muc | Noi dung |
| --- | --- |
| Website | https://is-425.vercel.app |
| Sitemap | https://is-425.vercel.app/sitemap.xml |
| Robots | https://is-425.vercel.app/robots.txt |
| Email | hello@taynguyenfood.vn |
| Hotline | 090 123 4567 |
| Dia chi | 12 Nguyen Tat Thanh, Buon Ma Thuot, Dak Lak |

## 3.3.1 Khai bao Google Search Console

1. Vao https://search.google.com/search-console.
2. Chon Add property.
3. Neu dung domain Vercel, chon URL prefix va nhap `https://is-425.vercel.app`.
4. Chon phuong thuc HTML tag.
5. Copy ma trong `content="..."`.
6. Mo `index.html`, thay `THAY_MA_XAC_MINH_SEARCH_CONSOLE_TAI_DAY` bang ma vua copy.
7. Commit va deploy lai Vercel.
8. Quay lai Search Console, bam Verify.
9. Chup nguyen man hinh ket qua xac minh thanh cong.

## 3.3.2 Submit Sitemap

1. Trong Search Console, vao Sitemaps.
2. Nhap `sitemap.xml`.
3. Bam Submit.
4. Cho trang hien trang thai Success hoac Submitted.
5. Chup nguyen man hinh ket qua.

## Google Analytics 4

1. Vao https://analytics.google.com.
2. Tao property cho Tay Nguyen Food.
3. Tao Web data stream voi URL `https://is-425.vercel.app`.
4. Copy Measurement ID dang `G-XXXXXXXXXX`.
5. Mo `index.html`, thay 2 vi tri `G-XXXXXXXXXX` bang Measurement ID that.
6. Commit va deploy lai Vercel.
7. Vao Realtime de kiem tra co user dang truy cap.
8. Chup man hinh Realtime va cac bao cao can cho ASM.

## Bang minh chung can chup

| Cong cu | Chi so can chup | Dua vao ASM |
| --- | --- | --- |
| GA4 Realtime | Users trong 30 phut gan nhat | Chung minh da cai tracking |
| GA4 Reports | Users, New users, Engagement time | Chuong V - Google Analytics |
| GA4 Acquisition | Session source / medium | Phan tich nguon truy cap |
| GA4 Pages and screens | Trang duoc xem nhieu | Danh gia noi dung website |
| Search Console Performance | Impressions, Clicks, CTR, Average position | Chuong V - SEO performance |
| Search Console Queries | Tu khoa nguoi dung tim thay web | Danh gia keyword |
| Search Console Pages | Trang duoc Google ghi nhan | Danh gia lap chi muc |
| Search Console Sitemaps | Trang thai sitemap | Minh chung submit sitemap |

## Plugin / cong cu nen liet ke trong ASM

| Plugin / cong cu | Anh minh chung | Vai tro |
| --- | --- | --- |
| Google Analytics 4 | Anh man hinh Realtime va Reports | Do users, new users, engagement, traffic source, device |
| Google Search Console | Anh Performance va Sitemaps | Do impressions, clicks, CTR, ranking, indexed pages |
| PageSpeed Insights | Anh diem mobile va desktop | Danh gia toc do tai trang |
| SEOquake | Anh audit on-page | Kiem tra title, meta, heading, internal link |
| Screaming Frog | Anh crawl report | Kiem tra URL, status code, title, meta, H1 |

## Ghi chu nop bai

- Neu GA4 hoac Search Console chua co du lieu, ghi ro ngay cai dat va thoi gian cho Google thu thap.
- Khong dien cac so nhu 350 users, 1.200 impressions, Top 10 neu chua co anh minh chung.
- Voi website moi, Search Console co the can vai ngay moi hien impression va query.
