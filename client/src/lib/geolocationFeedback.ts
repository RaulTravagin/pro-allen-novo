export function geolocationErrorMessage(code?: number) {
  if (code === 1) {
    return "A permissão de localização foi negada. Se quiser registrar o GPS, abra as configurações do site pelo cadeado do navegador, permita Localização e tente novamente. A chegada ou saída continuará sendo registrada sem coordenadas.";
  }
  if (code === 2) {
    return "Não foi possível encontrar sua localização agora. Confira se o GPS está ativo e tente novamente; a chegada ou saída continuará sendo registrada sem coordenadas.";
  }
  if (code === 3) {
    return "A localização demorou para responder. Confira se o GPS está ativo e tente novamente; a chegada ou saída continuará sendo registrada sem coordenadas.";
  }
  return "Não foi possível capturar a localização. Confira a permissão do navegador e tente novamente; a chegada ou saída continuará sendo registrada sem coordenadas.";
}

export function geolocationUnavailableMessage() {
  return "Este navegador não oferece geolocalização. A chegada ou saída será registrada sem coordenadas.";
}
