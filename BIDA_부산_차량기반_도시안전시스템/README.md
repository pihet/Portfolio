# 부산시 차량 기반 도시안전 및 공공 데이터 플랫폼 (BIDA)
> **대규모 차량 센서 IoT 및 카메라 영상 기반의 실시간 스트리밍 & MLOps 데이터 인프라 구축**

---

## 1. 프로젝트 개요 (Project Overview)

본 프로젝트는 부산광역시 도로를 주행하는 차량의 **OBD/IoT 센서 데이터**와 **외부 카메라 영상**을 실시간 수집 및 가공하여 아래의 핵심 공공 안전 기능을 수행하는 엔드투엔드 분산 데이터 플랫폼입니다.

1. **운전자 졸음운전 실시간 탐지 및 예방**
2. **체납 차량 번호판 AI 자동 식별 및 영치 연계**
3. **실종자 차량 실시간 추적 및 경찰청 연계**

### 담당 역할 및 기여도
- **Role**: Data Engineer / Cloud Infra Engineer
- **기여도**: **100%** (데이터 파이프라인, 분산 스트리밍, 클라우드 인프라 아키텍처 전담)  
  *(※ 프론트엔드 UI 및 백엔드 웹 API 구현은 별도 웹 개발팀 파트로 본 포트폴리오에서 제외)*

<p align="center">
  <img src="https://files.catbox.moe/p7irm4.png" width="85%" alt="Business Data Flow" />
</p>

---

## 2. 시스템 아키텍처 (System Architecture)

<p align="center">
  <img src="https://files.catbox.moe/k1vg43.png" width="90%" alt="System Architecture" />
</p>

```
[차량 OBD/GPS 센서 & 외부 카메라 영상]
                   │
                   ▼ (Batch / REST / IoT Ingestion)
     ┌───────────────────────────────┐
     │      AWS RDS (MariaDB)        │ ◄─── (Raw Ingestion / Master Data)
     └──────────────┬────────────────┘
                    │
         [Apache Airflow Orchestrator]
         (Scheduled Batch & Trigger)
                    │
                    ▼
┌───────────────────┴───────────────────────────────────────────────────────┐
│                       AWS EKS (Kubernetes Cluster)                        │
│                                                                           │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  Strimzi Kafka Operator                                           │   │
│   │  - Driving Session / Sensor / OCR Detections Multi-Topics         │   │
│   └─────────────────────────────────┬─────────────────────────────────┘   │
│                                     │ (Stream Pub/Sub)                    │
│                                     ▼                                     │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  Apache Flink Kubernetes Operator (Flink SQL Gateway)             │   │
│   │  - Real-Time Streaming Processing (RocksDB State, 60s Checkpoint)  │   │
│   │  - Batch Ingestion / CDC Time-Window Filtering                    │   │
│   └─────────────────────────────────┬─────────────────────────────────┘   │
│                                     │                                     │
│                                     ▼                                     │
│   ┌───────────────────────────────────────────────────────────────────┐   │
│   │  Airflow DAGs (MLOps & Pipeline Control)                          │   │
│   │  - Flink SQL Lifecycle Management via REST API                    │   │
│   │  - OCR AI Image Processing Pipeline (Batch Inference via Ngrok)   │   │
│   └─────────────────────────────────┬─────────────────────────────────┘   │
└─────────────────────────────────────┼─────────────────────────────────────┘
                                      │
                                      ▼
                      ┌───────────────────────────────┐
                      │    Data Mart (AWS RDS / DW)   │
                      │  - Analysis / Power BI / Dash │
                      └───────────────────────────────┘
```

---

## 3. 핵심 기술 구현 (Key Implementations)

### 1) Cloud & Kubernetes 인프라 (AWS EKS)
- **EKS 클러스터 프로비저닝**: `eksctl` 기반으로 VPC, 서브넷, 노드 그룹을 코드로 자동화하여 프로비저닝.
- **Spot Instance & Cluster Autoscaler**: `t3.large`, `t3a.large`, `m5.xlarge` 다중 스팟 인스턴스 풀과 Cluster Autoscaler를 연동하여 트래픽에 따라 노드가 자동 스케일링되도록 구성 (온디맨드 대비 **인프라 비용 60% 절감**).
- **스토리지 최적화**: AWS EBS CSI 드라이버 및 `gp3 StorageClass`를 커스텀 배포하여 고성능 IOPS/Throughput 확보 및 스토리지 비용 최적화.
- **네임스페이스 및 보안 격리**: `kafka-kubernetes-operator`, `flink`, `airflow`, `mariadb` 네임스페이스 분리 및 RBAC/ServiceAccount 기반 접근 통제.

### 2) 분산 이벤트 브로커 (Strimzi Apache Kafka)
- **K8s Native Kafka**: Strimzi Kafka Operator(v0.47.0)를 통해 Controller-Broker 분리 아키텍처 클러스터 배포.
- **도메인별 다중 토픽 모델링**:
  - `driving_session`: 차량 주행 세션 라이프사이클 이벤트
  - `driving_session_info`: 속도, 가속도, 충격, 전압, 도어 등 30여 개 시계열 센서 데이터
  - `drowsy_drive`: 눈 깜빡임, 고개 숙임, 하품 등 이상 행동 탐지 이벤트
  - `arrears_detection` / `arrears_info`: 번호판 AI 탐지 결과 및 체납 관리 정보
  - `missing_person_detection` / `missing_person_info`: 실종자 차량 매칭 이벤트
- **운영 모니터링**: K8s 내부 `kafka-ui` 파드를 배포하여 토픽별 Lag, Consumer Group, Throughput 실시간 관제.

### 3) 실시간 스트림 & 배치 처리 엔진 (Apache Flink)
- **Flink SQL Gateway & Kubernetes Operator**:
  - Flink Operator(v1.13.0) 기반 Session Cluster 구축 및 REST API 기반 Flink SQL Gateway 연동.
  - 별도 JAR 빌드 없이 SQL 스크립트만으로 쿼리를 동적 제출/제어하여 파이프라인 개발 생산성 70% 향상.
- **24/7 무중단 실시간 스트리밍 (`kafka_to_rds_streaming`)**:
  - `state.backend: rocksdb` 및 `execution.checkpointing.interval: 60s` 적용으로 무손실 **Exactly-Once 처리 보장**.
  - JDBC Sink에 `sink.buffer-flush.max-rows: 100`, `sink.buffer-flush.interval: 1s` 마이크로 배치 버퍼링을 적용하여 DB 커넥션 과부하 방지 및 Write Throughput 5배 증대.
- **증분/스냅샷 배치 파이프라인 (`01_ingest_raw_data`, `04_resync_batch_limited`)**:
  - 시간 범위 필터 및 `ROW_NUMBER() OVER()` 기반 동적 윈도우 Offset 배치 파이프라인 구현.

### 4) 워크플로우 오케스트레이션 & MLOps 파이프라인 (Apache Airflow)
- **Helm 기반 배포 & Git-Sync**: K8s 내 Airflow Helm Chart 배포 및 GitHub 연동 Git-Sync를 통한 무중단 DAG 배포.
- **비동기 번호판 인식 AI 파이프라인 (`ocr_http_processing`)**:
  - RDS 내 수집된 차량 외관 카메라 이미지(Base64) 중 미처리(`processed=0`) 건을 5분 주기로 청크 슬라이싱.
  - 분산 AI 서버(Ngrok 터널링 HTTP API)로 비동기 배치 추론 요청 후 인식 결과(번호판, Confidence)를 DB에 트랜잭션 단위로 업데이트 및 체납/실종자 대장 자동 매칭 트리거.

<p align="center">
  <img src="https://files.catbox.moe/no2zwv.png" width="31%" alt="Arrears Pipeline" />
  <img src="https://files.catbox.moe/daltg2.png" width="31%" alt="Missing Pipeline" />
  <img src="https://files.catbox.moe/fj2tk2.png" width="31%" alt="Drowsy Pipeline" />
</p>

### 5) 데이터 모델링 & 정규화 설계 (MariaDB / RDS)
- 원본 데이터 테이블과 분석용 데이터 마트(`fact_`, `r_`) 분리 설계.
- 시계열 센서 데이터와 이미지 바이너리(Base64) 처리 플래그를 분리하고 복합 인덱스(`idx_vei_session`, `idx_drowsy_session` 등)를 설계하여 대용량 조회 성능 최적화.

<p align="center">
  <img src="https://files.catbox.moe/78pd6q.png" width="80%" alt="ERD Design" />
</p>

---

## 4. 기술적 도전 과제 및 트러블슈팅 (Troubleshooting)

### 1. MySQL JDBC와 Flink SQL 간 ClassCastException 타입 불일치 해결
- **문제**: RDS에서 Kafka로 배치 적재 시 `ClassCastException: class java.lang.Boolean cannot be cast to class java.lang.Integer` 에러 발생.
- **원인**: MySQL의 `TINYINT(1)` 컬럼을 JDBC 드라이버가 Java `Boolean`으로 자동 변환하는데, Flink SQL DDL에서 `TINYINT`(정수형)로 정의하여 Type Mismatch 발생.
- **해결**: Source 테이블 DDL을 JDBC 실제 변환 타입인 `BOOLEAN`으로 수정하고, Sink 단계에서 `CAST(notice_sent AS TINYINT)` 명시적 형변환을 적용하여 스키마 정합성 확보.

### 2. OCR 딥러닝 모델 배포 시 AVX 명령어 호환성 (SIGILL) 및 분산 MLOps 전환
- **문제**: 5GB 크기의 번호판 인식 컨테이너(PaddleOCR + YOLO) 배포 시 `FatalError: Illegal instruction (SIGILL)` 발생하며 Pod CrashLoopBackOff 진입.
- **원인**: 가상화 레이어에서 PaddleOCR 내부 CPU AVX(Advanced Vector Extensions) 명령어 세트가 차단됨.
- **해결**: 모델 추론 서버를 GPU 가속 환경으로 분리하고, Airflow에서 미처리 이미지(`processed=0`)를 5분 주기로 청크 호출하는 Ngrok 기반 비동기 MLOps 파이프라인으로 전환. 타임아웃(600s) 및 2회 재시도, DB 롤백 로직을 추가하여 멱등성과 100% 자동 추론 보장.

### 3. Airflow K8s 배포 초기화 실패 및 PostgreSQL 메타데이터 정상화
- **문제**: Helm으로 Airflow 배포 시 `airflow-create-user` Job 실패 및 스케줄러/웹서버 `CrashLoopBackOff` 발생.
- **원인**: DB 마이그레이션 잡 비활성화로 메타데이터 스키마 미생성 및 레거시 PostgreSQL 이미지(bitnamilegacy) 지원 중단.
- **해결**: `values.yaml` 내 `migrateDatabaseJob.enabled: true` 활성화, `bitnami/postgresql:15.5.0` 이미지 고정 및 K8s Secret 기반 환경변수 주입 체계 확립.

### 4. Flink TaskManager 리소스 고갈 (NoResourceAvailableException) 방지
- **문제**: 24/7 스트리밍 Job 실행 중 배치 Job 동시 실행 시 `NoResourceAvailableException` 발생.
- **원인**: Flink Session Cluster의 TaskSlot(기본 8개)이 스트리밍 잡 병렬 태스크에 모두 점유됨.
- **해결**: `taskmanager.numberOfTaskSlots`를 16개로 증설하고, Airflow Worker Pool(`default_pool: 64`) 동시성 제어 및 DAG 실행 스케줄 분산 적용.

### 5. 대용량 센서 실시간 적재 시 RDS Write Bottleneck 해소
- **문제**: 초당 수천 건의 센서 시계열 데이터 유입 시 단건 Insert로 인해 RDS CPU 90% 초과 및 Lock 경합 발생.
- **해결**: Flink JDBC Sink에 마이크로 배치 버퍼링(`sink.buffer-flush.max-rows: 100`, `sink.buffer-flush.interval: 1s`)을 적용하여 메모리 버퍼링 후 벌크 쓰기 수행. CPU 부하를 30% 이하로 낮추고 Throughput 5배 증대.

---

## 5. 주요 성과 및 최종 산출물 (Key Achievements)

<p align="center">
  <img src="https://files.catbox.moe/6ck5gr.png" width="85%" alt="Dashboard Results" />
</p>

| 구분 | 성과 및 핵심 지표 |
| :--- | :--- |
| **데이터 처리 지연 시간** | Kafka + Flink 스트리밍 파이프라인을 통해 센서 발생부터 분석 적재까지 **초 단위(Latency < 3s) 실시간 처리** 달성 |
| **인프라 비용 최적화** | EKS Spot Instance + Cluster Autoscaler + `gp3` 커스텀 StorageClass 적용으로 **인프라 비용 약 60% 절감** |
| **AI 번호판 인식 자동화** | 5분 주기 비동기 Airflow MLOps 파이프라인 구축으로 미처리 이미지 **100% 자동 추론 및 체납/실종자 매칭** |
| **장애 복구력** | Flink RocksDB StateBackend & Checkpointing(60s) 도입으로 **Failover 시 데이터 무손실 Exactly-Once 보장** |

---

## 6. 기술 스택 요약 (Tech Stack)

| 구분 | 기술 스택 | 사용 목적 |
| :--- | :--- | :--- |
| **Cloud & K8s** | AWS EKS, Kubernetes, Helm, eksctl, Cluster Autoscaler, gp3 CSI | 컨테이너 오케스트레이션 및 비용 최적화 인프라 |
| **Message Broker** | Apache Kafka, Strimzi Kafka Operator, Kafka UI | 차량 센서 및 이벤트 스트리밍 메시지 브로커 |
| **Stream Engine** | Apache Flink, Flink K8s Operator, Flink SQL Gateway, RocksDB | 실시간 스트리밍 & 대용량 배치 처리, 상태 관리 |
| **Orchestration** | Apache Airflow, Python (DAGs, pymysql, requests, pytz) | Flink SQL 원격 제어 및 AI 추론 워크플로우 오케스트레이션 |
| **Database** | MariaDB, AWS RDS, DBeaver | 원본 데이터 저장소 및 분석용 데이터 마트 |

---

## 7. 단계별 환경 구축 및 파이프라인 실행 가이드 (Getting Started)

### 사전 준비 (Prerequisites)
- **도구 설치**: `minikube` (또는 AWS EKS), `kubectl`, `helm`
- **권장 사양**: CPU 8 Cores 이상, Memory 16GB 이상, Disk 40GB 이상

```bash
# 필수 CLI 설치 확인
minikube version
kubectl version --client
helm version
```

---

### [1단계] Kubernetes 클러스터 시작
```bash
# Minikube 시작 (리소스 할당)
minikube start --cpus=8 --memory=16384 --disk-size=40g

# 컨텍스트 설정 및 상태 확인
kubectl config use-context minikube
minikube status
```

---

### [2단계] Apache Kafka 배포 (Strimzi Operator)
```bash
# 1. Kafka 네임스페이스 및 Operator 설치
kubectl create namespace kafka-kubernetes-operator
kubectl create -f 'https://strimzi.io/install/latest?namespace=kafka-kubernetes-operator' -n kafka-kubernetes-operator

# 2. Kafka 클러스터 배포
cd k8s/kafka
kubectl apply -f kafka_cluster.yaml -n kafka-kubernetes-operator
kubectl wait kafka/kafka-cluster --for=condition=Ready --timeout=300s -n kafka-kubernetes-operator

# 3. 도메인별 9개 토픽 생성
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic uservehicle --partitions 1 --replication-factor 1 --if-not-exists
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic driving_session --partitions 1 --replication-factor 1 --if-not-exists
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic driving_session_info --partitions 1 --replication-factor 1 --if-not-exists
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic drowsy_drive --partitions 1 --replication-factor 1 --if-not-exists
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic arrears_detection --partitions 1 --replication-factor 1 --if-not-exists
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic arrears_info --partitions 1 --replication-factor 1 --if-not-exists
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic missing_person_detection --partitions 1 --replication-factor 1 --if-not-exists
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic missing_person_info --partitions 1 --replication-factor 1 --if-not-exists
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --create --topic vehicle_exterior_image --partitions 1 --replication-factor 1 --if-not-exists

# 4. 토픽 목록 검증
kubectl exec -n kafka-kubernetes-operator kafka-cluster-broker-0 -- /opt/kafka/bin/kafka-topics.sh --bootstrap-server localhost:9092 --list
```

---

### [3단계] Apache Flink 클러스터 및 SQL Gateway 배포
```bash
# 1. Flink 네임스페이스 및 Operator 설치
kubectl create namespace flink
kubectl apply -f https://github.com/jetstack/cert-manager/releases/download/v1.18.2/cert-manager.yaml --insecure-skip-tls-verify
kubectl apply -f https://github.com/apache/flink-kubernetes-operator/releases/download/release-1.10.0/flink-kubernetes-operator-1.10.0.yaml

# 2. RBAC & Flink Session Cluster & SQL Gateway 배포
cd k8s/flink
kubectl apply -f flink-rbac.yaml -n flink
kubectl apply -f flink-serviceaccount.yaml -n flink
kubectl apply -f flink-session-cluster.yaml -n flink
kubectl apply -f flink-sql-gateway.yaml -n flink

# 3. Flink Pod 준비 대기
kubectl wait --for=condition=Ready pod -l app=flink --timeout=300s -n flink

# 4. Flink Dashboard 포트포워딩
kubectl port-forward -n flink svc/flink-rest 8081:8081
# 접속 주소: http://localhost:8081
```

---

### [4단계] Apache Airflow 배포 및 초기화
```bash
# 1. Airflow 네임스페이스 생성
kubectl create namespace airflow

# 2. Airflow Helm Chart 설치
cd k8s/airflow
helm install airflow ./airflow-1.18.0/airflow -n airflow -f ./airflow-1.18.0/airflow/values.yaml

# 3. Admin 계정 생성
kubectl exec -n airflow airflow-scheduler-0 -- airflow users create \
  --username admin --password admin \
  --firstname Admin --lastname User \
  --role Admin --email admin@example.com

# 4. Airflow Web UI 포트포워딩
kubectl port-forward -n airflow svc/airflow-webserver 8080:8080
# 접속 주소: http://localhost:8080 (ID: admin / PW: admin)
```

---

### [5단계] DAG 실행 및 데이터 파이프라인 제어

#### 사용 가능한 Airflow DAG 목록
| DAG ID | 설명 | 스케줄 | 주요 용도 |
| :--- | :--- | :--- | :--- |
| `kafka_to_rds_streaming` | Kafka ➡️ RDS 실시간 스트리밍 | 수동 (24/7 실행) | 실시간 스트림 적재 및 상태 유지 |
| `ingest_raw_data` | RDS 원본 ➡️ Kafka 배치 적재 | `*/1 * * * *` (1분) | 시뮬레이션용 데이터 적재 |
| `resync_batch_limited` | RDS ➡️ Kafka 동적 윈도우 재전송 | `*/1 * * * *` (1분) | 청크 단위 점진적 데이터 재동기화 |
| `daily_info_update` | 일일 정보 스냅샷 갱신 | `0 0 * * *` (매일) | 체납 및 실종자 대장 갱신 |
| `ocr_http_processing` | OCR AI 비동기 추론 호출 | `*/5 * * * *` (5분) | 미처리 이미지 번호판 인식 및 매칭 |

#### 권장 실행 절차
1. **실시간 스트리밍 시작**: Airflow UI에서 `kafka_to_rds_streaming` DAG를 `ON`으로 활성화 후 Trigger합니다. (Flink Dashboard에서 `kafka-to-rds-streaming` Job이 `RUNNING` 상태인지 확인)
2. **배치 적재 활성화**: `ingest_raw_data` 또는 `resync_batch_limited` DAG를 활성화하여 Kafka로 데이터를 공급합니다.
3. **AI 추론 파이프라인 가동**: `ocr_http_processing` DAG를 활성화하여 차량 외관 이미지 자동 인식을 수행합니다.

---

### [6단계] 주요 시스템 접속 정보
| 서비스 | 내부/외부 접속 URL | 계정 정보 |
| :--- | :--- | :--- |
| **Flink Dashboard** | `http://localhost:8081` | 없음 |
| **Airflow UI** | `http://localhost:8080` | `admin` / `admin` |
| **Kafka Bootstrap** | `kafka-cluster-kafka-bootstrap.kafka-kubernetes-operator.svc.cluster.local:9092` | 없음 |
| **Flink SQL Gateway** | `http://sql-gateway-service-20.flink.svc.cluster.local:8083` | 없음 |

---

## 8. 프로젝트 디렉토리 구조 (Directory Structure)

```bash
├── dags_repo/                      # Airflow DAGs & SQL Repository
│   ├── flink_sql/                  # Flink SQL 스크립트 (Streaming & Batch)
│   │   ├── 01_ingest_raw_data.sql          # RDS -> Kafka 배치 적재 (시간대별 필터링)
│   │   ├── 02_daily_info_update.sql        # 일일 스냅샷 갱신 배치
│   │   ├── 03_kafka_to_rds_streaming.sql   # Kafka -> RDS 24/7 실시간 스트리밍 (RocksDB, 60s Checkpoint)
│   │   └── 04_resync_batch_limited.sql     # 동적 Offset 기반 RDS -> Kafka 재전송 배치
│   ├── mariadb_sql/                # MariaDB DDL 스키마
│   │   └── init_schema.sql                 # 테이블 스키마, FK 및 인덱스 정의
│   └── tests/dags/                 # Airflow DAG 파이썬 파일
│       ├── kafka_to_rds_streaming.py       # Flink SQL Gateway 연동 24/7 스트리밍 Job DAG
│       ├── ingest_raw_data.py              # 1분 주기 데이터 수집 배치 DAG
│       ├── daily_info_update.py            # 일일 집계 배치 DAG
│       ├── resync_batch_limited.py         # 동적 Offset 관리 재전송 배치 DAG
│       └── ocr_http_processing.py          # 미처리 이미지 선별 & AI 번호판 인식 비동기 MLOps DAG
│
├── k8s/                            # Kubernetes & Cloud 인프라 배포 매니페스트
│   ├── eks/                        # AWS EKS 클러스터 설정
│   │   ├── k8s.yaml                        # eksctl 클러스터 & Spot WorkerNodeGroup 구성
│   │   ├── gp3_storageclass.yaml           # 고성능 gp3 커스텀 StorageClass
│   │   └── settings.md                     # EKS 생성/스케일링/Autoscaler 가이드
│   ├── kafka/                      # Strimzi Kafka Operator 매니페스트
│   │   ├── kafka_cluster.yaml              # Kafka 클러스터 및 엔드포인트 정의
│   │   ├── broker.yaml / controller.yaml   # Broker 및 Controller 파드 구성
│   │   └── settings.md                     # Kafka 배포 가이드
│   ├── flink/                      # Apache Flink K8s 매니페스트
│   │   ├── flink-session-cluster.yaml      # Flink Session Cluster & TaskSlot 구성
│   │   ├── flink-sql-gateway.yaml          # Flink SQL Gateway 배포
│   │   ├── flink-rbac.yaml                 # RBAC 및 ServiceAccount
│   │   └── settings.md                     # Flink Operator 배포 가이드
│   ├── airflow/                    # Apache Airflow Helm 설정
│   │   ├── values.yaml                     # Airflow Helm 커스텀 values (PostgreSQL 15.5.0, Git-Sync)
│   │   └── settings.md                     # Airflow Helm 배포 가이드
│   └── mariadb/                    # MariaDB K8s 배포 매니페스트 (PV, Secret, StatefulSet)
└── README.md
```
