// 판매글 속 전화번호와 계좌번호를 안전하게 [전화번호], [계좌번호]로 가려주는 함수입니다.
export function maskPersonalInfo(text) {
  if (typeof text !== 'string') return text;

  // 1. 전화번호 가리기 (휴대폰, 지역번호, 안심번호 등)
  const phoneRegex = /(?<![\d-])0\d{1,3}[-.\s]?\d{3,4}[-.\s]?\d{4}(?![\d-])/g;
  let masked = text.replace(phoneRegex, '[전화번호]');

  // 2. 계좌번호 가리기 (하이픈 구분, 하이픈 제거 시 10~16자리 숫자인 경우)
  const hyphenAccountRegex = /(?<![\d-])\d{2,6}(?:-\d{2,8}){1,4}(?![\d-])/g;
  masked = masked.replace(hyphenAccountRegex, (match) => {
    const digitsOnly = match.replace(/-/g, '');
    if (digitsOnly.length >= 10 && digitsOnly.length <= 16) {
      return '[계좌번호]';
    }
    return match;
  });

  // 3. 계좌번호 가리기 (연속된 10~16자리 숫자)
  const continuousAccountRegex = /(?<!\d)\d{10,16}(?!\d)/g;
  masked = masked.replace(continuousAccountRegex, '[계좌번호]');

  return masked;
}
