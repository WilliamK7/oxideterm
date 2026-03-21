// Wire Protocol v1
// Frame Format: [Type: 1 byte][Length: 4 bytes big-endian][Payload: n bytes]

export const MSG_TYPE_DATA = 0x00;
export const MSG_TYPE_RESIZE = 0x01;
export const MSG_TYPE_HEARTBEAT = 0x02;
export const MSG_TYPE_ERROR = 0x03;
export const HEADER_SIZE = 5; // 1 byte type + 4 bytes length

/** Encode a heartbeat response frame */
export const encodeHeartbeatFrame = (seq: number): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + 4);
  const view = new DataView(frame.buffer);
  view.setUint8(0, MSG_TYPE_HEARTBEAT);
  view.setUint32(1, 4, false);
  view.setUint32(5, seq, false);
  return frame;
};

/** Encode a data frame */
export const encodeDataFrame = (payload: Uint8Array): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + payload.length);
  const view = new DataView(frame.buffer);
  view.setUint8(0, MSG_TYPE_DATA);
  view.setUint32(1, payload.length, false);
  frame.set(payload, HEADER_SIZE);
  return frame;
};

/** Encode a resize frame */
export const encodeResizeFrame = (cols: number, rows: number): Uint8Array => {
  const frame = new Uint8Array(HEADER_SIZE + 4);
  const view = new DataView(frame.buffer);
  view.setUint8(0, MSG_TYPE_RESIZE);
  view.setUint32(1, 4, false);
  view.setUint16(5, cols, false);
  view.setUint16(7, rows, false);
  return frame;
};
