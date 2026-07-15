# 코드 서명 설정

릴리스 워크플로는 인증서 Secrets가 있으면 정식 서명을 적용합니다. 인증서가 없을 때 macOS 빌드는 ad-hoc 서명을 사용하고 Windows 빌드는 서명되지 않습니다.

## macOS 서명 및 공증

Apple Developer Program에서 `Developer ID Application` 인증서를 발급하고 키체인에서 개인 키와 함께 `.p12`로 내보냅니다.

```bash
openssl base64 -A -in certificate.p12 -out certificate-base64.txt
```

GitHub 저장소의 `Settings > Secrets and variables > Actions`에 다음 Secrets를 등록합니다.

- `APPLE_CERTIFICATE`: `certificate-base64.txt` 내용
- `APPLE_CERTIFICATE_PASSWORD`: `.p12` 내보내기 암호
- `KEYCHAIN_PASSWORD`: CI 임시 키체인에 사용할 임의의 강한 암호
- `APPLE_ID`: Apple ID 이메일
- `APPLE_PASSWORD`: Apple 계정에서 발급한 앱 전용 암호
- `APPLE_TEAM_ID`: Apple Developer Team ID

여섯 값이 모두 있어야 정식 서명과 공증이 완료됩니다.

## Windows 서명

신뢰할 수 있는 인증기관에서 코드 서명 인증서를 발급받아 개인 키를 포함한 `.pfx` 파일로 준비합니다.

macOS에서 Base64 값 생성:

```bash
openssl base64 -A -in certificate.pfx -out certificate-base64.txt
```

GitHub Actions Secrets:

- `WINDOWS_CERTIFICATE`: `certificate-base64.txt` 내용
- `WINDOWS_CERTIFICATE_PASSWORD`: `.pfx` 암호

워크플로가 인증서를 Windows 인증서 저장소로 가져오고 SHA-256 및 DigiCert 타임스탬프를 사용해 설치 파일을 서명합니다.

## 확인

Secrets 등록 후 새 `v*` 태그를 푸시합니다. GitHub Actions 로그에서 macOS `signing`/`notarizing`, Windows `Successfully signed` 메시지를 확인합니다.
