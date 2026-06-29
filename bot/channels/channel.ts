// 채널 추상화 — 메신저(텔레그램/슬랙/...)를 갈아끼우기 위한 공통 인터페이스.
// 새 메신저를 추가하려면 이 인터페이스를 구현한 어댑터 1파일만 만들면 된다.

/** 첨부 파일 (이미지·텍스트·미지원) — 채널 어댑터가 정규화해 채운다 */
export interface Attachment {
  path: string
  kind: 'image' | 'text' | 'unsupported'
  content?: string // kind='text' 일 때 인라인 내용 (50KB 제한)
}

export interface IncomingMessage {
  /** 사용자가 보낸 텍스트 (첨부만 보내면 빈 문자열) */
  text: string
  /** 채널 내 사용자 식별자 (텔레그램 chat id, 슬랙 user id 등) */
  userId: string
  /** 봇 소유자(주인) 여부 — 소유자만 명령을 받아들인다 */
  isOwner: boolean
  /** 답장(인용) 대상 메시지 */
  replyTo?: { text: string; from: string }
  /** 첨부 이미지·파일 (이미지·문서 통합) */
  attachments?: Attachment[]
  /** 음성 메시지 (STT 백엔드 있을 때만 처리 — 옵셔널 기능) */
  voice?: { path: string }
}

export interface ReplyHandle {
  /** 스트리밍 중 표시를 갱신한다 (throttle은 어댑터가 알아서) */
  update(text: string): Promise<void>
  /** 최종 응답을 확정한다 */
  final(text: string): Promise<void>
}

export interface Channel {
  /** 채널 이름 ('telegram' | 'slack' | ...) */
  readonly name: string
  /** 메시지 수신을 시작한다. 메시지마다 handler가 호출되고 reply 핸들이 전달된다. */
  start(
    handler: (msg: IncomingMessage, reply: ReplyHandle) => Promise<void>
  ): Promise<void>
  /** 소유자에게 능동적으로 알림을 보낸다 (하트비트 결과 등) */
  notify(text: string): Promise<void>
}
