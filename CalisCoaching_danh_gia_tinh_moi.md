# Đánh giá tính mới của đề tài CalisCoaching

**Ngày rà soát:** 26/10/2026.  
**Phạm vi:** đối chiếu mô tả CalisCoaching trong các tài liệu dự án với nghiên cứu và sản phẩm công khai. Đây là rà soát có mục tiêu, không phải tổng quan hệ thống hoặc tra cứu toàn bộ công trình đã công bố.

## Cập nhật theo bối cảnh cuộc thi và phần mở rộng

**Thông tin người dùng làm rõ:** cuộc thi chấp nhận một MVP khả thi, có tiềm năng. Vì vậy, đánh giá tính mới học thuật dưới đây không đủ để suy ra khả năng vào vòng trong. Với tiêu chí người dùng nêu, CalisCoaching có cơ sở để tiếp tục phát triển hồ sơ dự thi; cần đánh giá đồng thời MVP, khác biệt sản phẩm và hướng mở rộng.

**Phần mở rộng đọc được trong thư mục:** mục 6 của báo cáo tiền khả thi mô tả hồ sơ người tập đa môn, dữ liệu sức khỏe/hoạt động, lịch tập chung, tiêu chí và logic chuyên môn riêng từng môn; các phần khác đề cập mở sang cầu lông, bóng đá, chạy bộ, wearable và kết nối HLV. Thư mục hiện chứa các báo cáo đánh giá, chưa có bản đề xuất gốc riêng để kiểm tra liệu tầm nhìn của tác giả còn cơ chế khác chưa được ghi nhận.

**Đánh giá điều chỉnh:** đối chiếu với ứng dụng calisthenics đơn lẻ chỉ đánh giá được một phần đề tài. Tầm nhìn phối hợp nhiều môn dựa trên hồ sơ liên tục mở ra bài toán sản phẩm rộng hơn. Tuy nhiên, sự kết hợp cụ thể cần được so sánh; hiện chưa xác nhận được tuyên bố “chưa nơi nào có”. Các nguồn gần hơn với phần mở rộng gồm:

- [Pelaris](https://pelaris.io/) công bố xây chương trình phối hợp nhiều môn, điều chỉnh theo buổi tập, giấc ngủ và phản hồi. Đây là đối chiếu trực tiếp cho kế hoạch đa môn thích ứng; nguồn chưa đủ để kết luận có toàn bộ quy trình video, tăng cấp kỹ năng và HLV của CalisCoaching.
- [Athletica — FAQ](https://athletica.ai/frequently-asked-questions) mô tả dùng dữ liệu tập, nhịp tim, HRV, giấc ngủ và phản hồi để điều chỉnh chương trình; hỗ trợ nhiều môn thiên về sức bền. Chưa đủ để coi tương đương coaching kỹ thuật calisthenics/cầu lông/bóng đá.
- [AICoach](https://aiartlens.com/) công bố phản hồi kỹ thuật qua camera cho nhiều môn, gồm cầu lông, bóng đá và fitness. Website này chưa chứng minh lịch tập và hồ sơ phục hồi được phối hợp giữa các môn.

Đây là các mô tả của nhà cung cấp được đọc ngày 26/10/2026, chưa phải kết quả kiểm thử độc lập. Một nền tảng có thành phần tương tự chưa đủ chứng minh trùng toàn bộ sản phẩm; ngược lại, chưa tìm thấy bản trùng hoàn toàn cũng chưa xác nhận tính độc nhất.

**MVP đề xuất để thể hiện tiềm năng mở rộng:** có một chương trình calisthenics hoạt động được, hồ sơ và nhật ký chung; hoạt động môn thứ hai có thể nhập thủ công. Trình diễn một tình huống mà hoạt động môn thứ hai được xét trong đề xuất lịch, với quy tắc do HLV duyệt và lời giải thích. Phân tích video chỉ cần phục vụ phạm vi calisthenics đã chọn. Cần phân biệt rõ chức năng chạy thật, dữ liệu tình huống mô phỏng và tính năng thuộc lộ trình.

Với cách đó, MVP có thể minh họa được giả thuyết giá trị của nền tảng đa môn mà không đòi hỏi hoàn thiện AI cho mọi môn. Việc giữ phạm vi triển khai nhỏ và trình bày tầm nhìn lớn có thể đi cùng nhau. Khả năng cạnh tranh thực tế vẫn cần được đánh giá trên bản demo, người dùng mục tiêu và tiêu chí cụ thể của cuộc thi.

## Kết luận về ý tưởng calisthenics ban đầu và tính mới học thuật

**Kết luận trong phạm vi này:** CalisCoaching chưa mới ở ý tưởng “AI phân tích video calisthenics, phản hồi kỹ thuật và cá nhân hóa tiến trình”. Có cả sản phẩm rất gần và nghiên cứu trực tiếp về các thành phần này. Mô tả hiện tại chưa xác lập đóng góp nghiên cứu riêng. Nhận định đó không phải kết luận rằng toàn bộ tầm nhìn mở rộng thiếu giá trị hoặc đề tài không đáp ứng cuộc thi khởi nghiệp.

Đánh giá này dựa trên hai báo cáo tiền khả thi và kỹ thuật trong thư mục dự án; chưa có đề cương nghiên cứu hoặc thuật toán chi tiết để thẩm định. Phần “hạt nhân đổi mới” trong báo cáo tiền khả thi nên được hiểu là giả thuyết tạo khác biệt cần kiểm chứng.

## Sản phẩm có phạm vi gần CalisCoaching

Các chức năng dưới đây là mô tả công khai của nhà phát triển, được kiểm tra ngày 26/10/2026. Chưa cài đặt hoặc kiểm thử độc lập; sự tồn tại của mô tả tính năng không chứng minh độ chính xác hoặc hiệu quả tập luyện.

| Sản phẩm | Tính năng được nhà phát triển công bố | Hàm ý đối với tính mới |
|---|---|---|
| **Calisthenics AI: Coach** | Chấm video kỹ năng, nhận xét theo khung hình, đề xuất bài tập dựa trên mục tiêu và lịch sử, lập chương trình nhiều tuần. Có trang ứng dụng trên App Store. [Website](https://calisthenicsai.app/), [App Store](https://apps.apple.com/us/app/calisthenics-ai-coach/id6760506157). | Trùng khá sát tổ hợp phân tích video, phản hồi và cá nhân hóa. Mô tả tính năng chung của CalisCoaching chưa tạo khác biệt rõ. |
| **CaliLens** | Chấm kỹ năng calisthenics theo bộ quy tắc, nêu lỗi và bài sửa; theo dõi các biến thể kỹ năng. Theo website, điểm chỉ được gắn nhãn “Certified” khi mọi tiêu chí đều đánh giá được. [Website](https://calilens.app/), [App Store](https://apps.apple.com/us/app/calilens-calisthenics-ai/id6760661846). | Cả quy tắc giải thích được và điều kiện chất lượng video đều có tiền lệ sản phẩm. Chưa đủ bằng chứng để coi đây là cơ chế chuyển cấp dài hạn giống CalisCoaching. |
| **Calistree** | Cây kỹ năng, bài tập dễ/khó liên quan và tự điều chỉnh tiến trình theo kết quả buổi tập. [Website chính thức](https://calistree.com/). | Lộ trình kỹ năng và tăng/giảm độ khó đã có; nguồn này không chứng minh chấm kỹ thuật bằng camera. |
| **Freeletics** | Tài liệu Coach Feedback mô tả dùng chất lượng kỹ thuật do người tập tự đánh giá để giao bài khó hơn. [Tài liệu chính thức](https://www.freeletics.com/en/blog/posts/coach-feedback/). | Nguyên tắc dùng chất lượng kỹ thuật cho tiến trình đã có tiền lệ. Cần phân biệt tự báo cáo với đánh giá video. |
| **Kemtai** | Công bố phản hồi động tác qua camera kết hợp công cụ kê chương trình và theo dõi của chuyên gia trong phục hồi chức năng. [Trang sản phẩm](https://kemtai.com/digital-rehab/). | Là tiền lệ ở lĩnh vực gần cho phối hợp AI và chuyên gia; không đủ để kết luận trùng toàn bộ quy trình calisthenics. |

**Suy luận từ đối chiếu:** mức độ khác biệt hiện tại còn yếu ở cả thành phần và tổ hợp tính năng mô tả rộng. Chưa xác minh được sản phẩm nào làm đúng toàn bộ quy trình dự kiến; điều đó cũng chưa chứng minh quy trình này là mới. Muốn khẳng định lợi thế, cần so sánh cùng một nhiệm v
ụ cụ thể.

## Tiền lệ học thuật đã xác minh

### 1. Progress-Up — phản hồi kỹ thuật các biến thể chống đẩy (2026)

**Development of a Mobile Application for Real-Time Push-Up Progression Feedback via Angle Heuristics**, xuất bản năm 2026 trong kỷ yếu WCTP 2025, là tiền lệ rất gần. Ứng dụng dùng MoveNet và quy tắc góc để chấm kỹ thuật; các tiêu chí được lượng hóa với hướng dẫn của chuyên gia vận động. Hệ thống có phản hồi sau từng lần tập và nhật ký buổi tập; thiết kế sáu biến thể chống đẩy, thử nghiệm năm biến thể. Tác giả thừa nhận ứng dụng còn hạn chế thực tiễn. “Progression” ở đây chỉ các biến thể bài tập; bài báo chưa chứng minh một cơ chế tự quyết định chuyển cấp dài hạn. [Bài báo gốc, tr. 241–256](https://www.atlantis-press.com/article/126023784.pdf)

**Hàm ý cho CalisCoaching:** chọn riêng chống đẩy, kết hợp pose có sẵn với rubric chuyên gia, phản hồi kỹ thuật và theo dõi buổi tập chưa đủ để tuyên bố mới về nghiên cứu.

### 2. Pose Trainer — pose estimation và phản hồi sửa tư thế (2020)

**Pose Trainer: Correcting Exercise Posture using Pose Estimation** mô tả ứng dụng dùng OpenPose, hình học và học máy để phản hồi kỹ thuật từ video. Bốn bài là bicep curl, front raise, shoulder shrug và shoulder press. Nhóm ghi hơn 100 video đúng/sai; đây là dự án học phần được đưa lên arXiv, với ứng dụng máy tính chứ chưa phải hệ thống coaching trên điện thoại được kiểm định rộng. Công trình thể hiện mô hình “pose có sẵn → diễn giải động tác → phản hồi cá nhân” đã tồn tại từ năm 2020. [Toàn văn của tác giả](https://arxiv.org/html/2006.11718v1)

**Hàm ý:** sử dụng một thư viện nhận diện khớp rồi thêm luật sửa lỗi là hướng triển khai hợp lý, nhưng bản thân kiến trúc đó không phải đóng góp mới.

### 3. Fitness-AQA — dữ liệu chuyên gia và đánh giá lỗi kỹ thuật (ECCV 2022)

**Domain Knowledge-Informed Self-Supervised Representations for Workout Form Assessment** xây dựng biểu diễn ảnh/video cho nhận diện lỗi bài tập, cùng dữ liệu Fitness-AQA có nhãn từ huấn luyện viên. Bộ bài gồm back squat, barbell row và overhead press; nghiên cứu xem xét khó khăn từ góc máy, che khuất, ánh sáng và trang phục. Phạm vi là phát hiện lỗi kỹ thuật, không phải quyết định tăng cấp calisthenics. [Trang công trình tại ECVA/ECCV](https://www.ecva.net/papers/eccv_2022/papers_ECCV/html/5907_ECCV_2022_paper.php)

**Hàm ý:** “có dữ liệu được HLV gắn nhãn” chưa tự tạo tính mới. Nhóm cần chỉ ra dữ liệu mới bao phủ tình huống nào còn thiếu và đánh giá được bài toán nào mà dữ liệu sẵn có không đáp ứng.

### 4. Learnable Physics — MediaPipe, đếm lần và sửa kỹ thuật (RecSys 2023)

**Using Learnable Physics for Real-Time Exercise Form Recommendations** kết hợp MediaPipe, tách lần tập theo chuyển động và mô hình học động lực để nhận diện lỗi, đưa phản hồi. Sáu bài được đánh giá gồm squat, push-up, lunge, sit-up, shoulder press và front raise. Dữ liệu bốn bài toàn thân chỉ gồm bảy người; lỗi được chuyên gia gắn nhận xét sửa. Công trình đã đi xa hơn đếm lần đơn thuần, nhưng kết quả trên dữ liệu này không bảo đảm chất lượng cho người dùng mới trong mọi điều kiện quay. [Toàn văn, RecSys 2023](https://arxiv.org/html/2310.07221v1)

**Hàm ý:** chuỗi xử lý video → khớp → đếm lần → nhận diện lỗi → gợi ý đã có tiền lệ trực tiếp, kể cả chống đẩy.

### 5. Isometric Pose Evaluation — độ không chắc chắn khi nhận diện lỗi (2025)

**Real-Time Feedback and Benchmark Dataset for Isometric Pose Evaluation** là bản thảo arXiv năm 2025 về sáu tư thế tĩnh, trong đó có plank. Nghiên cứu đề xuất chỉ số tách ba phần: phân biệt đúng/sai, nhận diện loại lỗi có độ tin cậy cao và trường hợp không chắc loại lỗi. Tác giả nêu dữ liệu chỉ có nam giới, số lỗi còn hạn chế và cần nghiên cứu sử dụng dài hạn. Đây là tiền lệ về đánh giá độ không chắc chắn, chưa phải bằng chứng cho một quy trình chuyển ca sang HLV hoặc duyệt tăng cấp. [Toàn văn, đặc biệt mục 6–7](https://arxiv.org/html/2506.11774v1)

**Hàm ý:** hiển thị confidence hoặc xử lý trường hợp không chắc cũng không nên được trình bày như một ý tưởng chưa từng có. Phần cần chứng minh là cơ chế cụ thể và hiệu quả thực tế của nó trong bài toán đã chọn.

## Những kết luận học thuật có thể bảo vệ

- **Có tiền lệ rõ ràng:** dùng pose estimation cho phản hồi tập luyện; quy tắc góc dựa trên chuyên môn; chấm lỗi chống đẩy và biến thể; dữ liệu HLV gắn nhãn; phân tích độ không chắc chắn khi nhận diện lỗi.
- **Chưa được chứng minh trong mô tả CalisCoaching hiện tại:** thuật toán, bộ dữ liệu hoặc cơ chế quyết định mới có kết quả vượt phương pháp so sánh phù hợp.
- **Hướng nghiên cứu có thể tiếp tục kiểm chứng:** quyết định giữ bài/chuyển mức dựa trên chất lượng kỹ thuật qua nhiều buổi, với quy tắc yêu cầu quay lại hoặc chuyển HLV khi thiếu bằng chứng. Đây là giả thuyết đóng góp cần rà soát và thử nghiệm tiếp, không phải kết luận rằng chưa ai làm.
- **Đánh giá phù hợp cho hướng này:** độ đồng thuận với HLV độc lập về quyết định chuyển mức; tỷ lệ cho chuyển mức khi chuyên gia chưa đồng ý; tỷ lệ hệ thống tự xử lý được; thời gian HLV cho mỗi trường hợp; kết quả trên người chưa xuất hiện trong tập xây dựng hệ thống.

## Giới hạn của rà soát

Các nguồn trên đủ bác bỏ tuyên bố rộng rằng “AI nhìn video và sửa kỹ thuật calisthenics là hoàn toàn mới”. Chúng không chứng minh mọi chi tiết của CalisCoaching đều đã được thực hiện, cũng không xác nhận một khoảng trống nghiên cứu độc quyền. Các công trình có phạm vi và mức kiểm định khác nhau; không so sánh trực tiếp các con số độ chính xác giữa bộ dữ liệu khác nhau. Rà soát này chưa đánh giá đầy đủ đề tài nội bộ, luận văn chưa công khai hoặc toàn bộ nghiên cứu tại Việt Nam; vì vậy chưa có cơ sở dùng tuyên bố “đầu tiên tại Việt Nam”.

## Đánh giá theo mục đích sử dụng đề tài

| Mục đích | Đánh giá hiện tại |
|---|---|
| Đồ án phát triển ứng dụng | Có thể phù hợp nếu tiêu chí của trường chấp nhận đóng góp ở thiết kế, triển khai và đánh giá hệ thống. Cần ghi nhận các giải pháp có trước. |
| Nghiên cứu khoa học hoặc luận văn yêu cầu tính mới | Chưa đủ bằng chứng trong hồ sơ hiện tại. Cần câu hỏi nghiên cứu, đóng góp riêng và so sánh với phương pháp gần nhất. |
| Dự án khởi nghiệp | Có thể tiếp tục kiểm chứng nhu cầu, chất lượng dịch vụ và kinh tế vận hành. Ý tưởng mới toàn cầu không phải điều kiện duy nhất; hồ sơ hiện tại cũng chưa chứng minh khả năng kinh doanh. |
| Tuyên bố đầu tiên ở Việt Nam | Chưa xác lập. Ngôn ngữ tiếng Việt hoặc chọn khách hàng Hà Nội tự thân chưa tạo đóng góp công nghệ. |

## Hướng đề xuất để hình thành đóng góp riêng

Đây là đề xuất của người đánh giá, chưa phải khoảng trống đã được xác nhận:

> Hỗ trợ quyết định chuyển mức bài tập calisthenics từ video điện thoại với kiểm soát độ tin cậy và giám sát của huấn luyện viên.

Câu hỏi nghiên cứu có thể là: **với cùng một ngân sách thời gian HLV, sử dụng bằng chứng kỹ thuật qua nhiều buổi và cơ chế từ chối khi thiếu dữ liệu có làm giảm quyết định chuyển mức không phù hợp so với đánh giá một buổi bằng quy tắc cố định hay không?**

Để biến câu hỏi thành đóng góp có thể đánh giá:

1. Chọn một chuỗi biến thể của một bài tập. HLV xác định tiêu chí giữ bài, đề nghị chuyển mức, yêu cầu quay lại và chuyển người đánh giá. Không mặc định đạt một số lần bất kỳ là đủ.
2. Xây tập dữ liệu có cả kết quả từng buổi, video khó quan sát và quyết định chuyên gia. Hai HLV chấm độc lập một phần dữ liệu; ghi nhận bất đồng. Thu thập dữ liệu tại Việt Nam có giá trị khi chứng minh được điều kiện mà bộ dữ liệu trước chưa bao phủ.
3. So sánh ít nhất ba cách: dựa trên số lần; quy tắc kỹ thuật cố định của một buổi; cơ chế đề xuất sử dụng nhiều buổi và độ tin cậy. Tách riêng tác dụng của lịch sử, ngưỡng từ chối và thời gian HLV để biết cải thiện đến từ đâu.
4. Đánh giá trên người chưa dùng để xây dựng hệ thống. Đo quyết định cho chuyển mức khi chuyên gia đánh giá chưa đạt, mức đồng thuận, tỷ lệ tự xử lý, tỷ lệ cần quay lại và phút HLV. So sánh ở cùng ngân sách chuyên gia hoặc trình bày đầy đủ đánh đổi giữa lỗi và chi phí.
5. Nếu muốn khẳng định giúp người dùng tiến bộ hơn, cần thử nghiệm theo thời gian với nhóm so sánh phù hợp. Đồng thuận với HLV trên video chưa chứng minh hiệu quả tập luyện dài hạn.

Tên đề tài phù hợp hơn không tự tạo tính mới. Giá trị nghiên cứu sẽ nằm ở cơ chế cụ thể và kết quả kiểm chứng. Nhóm có thể dùng mô hình pose có sẵn; không bắt buộc tự huấn luyện một mô hình lớn để có đóng góp.

## Cách trình bày trong đề cương

Có thể viết ở giai đoạn hiện tại:

> CalisCoaching kế thừa các phương pháp ước lượng tư thế và phản hồi kỹ thuật đã có. Đề tài tập trung xây dựng và đánh giá cơ chế hỗ trợ quyết định chuyển mức cho người mới tập, sử dụng lịch sử thực hiện, độ tin cậy của đánh giá video và sự giám sát của huấn luyện viên. Mức cải thiện sẽ được đo so với các phương pháp nền trên dữ liệu có nhãn chuyên gia.

Chưa nên dùng các tuyên bố “đầu tiên”, “độc quyền”, “chính xác hơn”, hoặc “ngăn ngừa chấn thương” khi chưa có bằng chứng tương ứng.
