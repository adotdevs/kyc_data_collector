<?php

declare(strict_types=1);

ini_set('display_errors', '0');
header('Content-Type: application/json; charset=utf-8');

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    respond(405, false, 'Method not allowed.');
}

function respond(int $status, bool $success, string $message): void
{
    http_response_code($status);
    echo json_encode(['success' => $success, 'message' => $message]);
    exit;
}

function plain(string $key): string
{
    $value = $_POST[$key] ?? '';
    if (!is_string($value)) {
        return '';
    }
    return trim(str_replace(["\r", "\n"], ' ', $value));
}

function multiline(string $key): string
{
    $value = $_POST[$key] ?? '';
    if (!is_string($value)) {
        return '';
    }
    $value = str_replace(["\r\n", "\r"], "\n", $value);
    if (strlen($value) > 20000) {
        $value = substr($value, 0, 20000) . "\n[truncated]";
    }
    return trim($value);
}

function encode_name(string $name): string
{
    $name = trim(str_replace(["\r", "\n"], '', $name));
    return '=?UTF-8?B?' . base64_encode($name) . '?=';
}

function smtp_command($socket, string $command, array $ok): void
{
    if (fwrite($socket, $command . "\r\n") === false) {
        throw new RuntimeException('Could not talk to the mail server.');
    }
    $response = '';
    while (($line = fgets($socket, 515)) !== false) {
        $response .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    $code = (int) substr($response, 0, 3);
    if (!in_array($code, $ok, true)) {
        $detail = trim(preg_replace('/\s+/', ' ', $response));
        throw new RuntimeException($detail !== '' ? $detail : 'The mail server rejected the message.');
    }
}

function smtp_send(array $config, string $message): void
{
    $host = (string) $config['smtp_host'];
    $port = (int) $config['smtp_port'];
    $secure = strtolower((string) ($config['smtp_secure'] ?? 'ssl'));
    $remote = ($secure === 'ssl' ? 'ssl://' : 'tcp://') . $host . ':' . $port;
    $socket = @stream_socket_client($remote, $errno, $errstr, 20);
    if (!$socket) {
        throw new RuntimeException('Could not connect to the mail server.');
    }
    stream_set_timeout($socket, 20);

    $greeting = '';
    while (($line = fgets($socket, 515)) !== false) {
        $greeting .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    if ((int) substr($greeting, 0, 3) !== 220) {
        fclose($socket);
        throw new RuntimeException('The mail server did not accept the connection.');
    }

    $from = (string) $config['mail_from'];
    $to = (string) $config['mail_to'];
    smtp_command($socket, 'EHLO goin-in-vest.com', [250]);
    smtp_command($socket, 'AUTH LOGIN', [334]);
    smtp_command($socket, base64_encode((string) $config['smtp_user']), [334]);
    smtp_command($socket, base64_encode((string) $config['smtp_pass']), [235]);
    smtp_command($socket, 'MAIL FROM:<' . $from . '>', [250]);
    smtp_command($socket, 'RCPT TO:<' . $to . '>', [250, 251]);
    smtp_command($socket, 'DATA', [354]);

    $payload = preg_replace('/^\./m', '..', str_replace(["\r\n", "\r"], "\n", $message));
    $payload = str_replace("\n", "\r\n", $payload);
    if (fwrite($socket, $payload . "\r\n.\r\n") === false) {
        fclose($socket);
        throw new RuntimeException('Could not send the message.');
    }
    $accepted = '';
    while (($line = fgets($socket, 515)) !== false) {
        $accepted .= $line;
        if (isset($line[3]) && $line[3] === ' ') {
            break;
        }
    }
    fwrite($socket, "QUIT\r\n");
    fclose($socket);
    if ((int) substr($accepted, 0, 3) !== 250) {
        throw new RuntimeException(trim($accepted) !== '' ? trim($accepted) : 'The mail server rejected the message.');
    }
}

$configFile = __DIR__ . '/.private/mail-config.php';
if (!is_readable($configFile)) {
    respond(500, false, 'Mail is not configured on the server.');
}

$config = require $configFile;
foreach (['smtp_host', 'smtp_port', 'smtp_user', 'smtp_pass', 'mail_from', 'mail_to'] as $key) {
    if (empty($config[$key])) {
        respond(500, false, 'Mail is not configured on the server.');
    }
}

$fullName = plain('full_name');
$email = plain('email');
$helpWith = $_POST['help_with'] ?? [];
$signature = (string) ($_POST['signature'] ?? '');

if (
    $fullName === '' || plain('id_passport') === '' || $email === '' || plain('phone') === ''
    || plain('street_address') === '' || plain('city') === '' || plain('postal') === '' || plain('country') === ''
    || $signature === '' || plain('agree_terms') === ''
    || !is_array($helpWith) || $helpWith === []
) {
    respond(422, false, 'Please complete all required fields before submitting.');
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    respond(422, false, 'Please enter a valid email address.');
}

$helpLabels = [];
foreach ($helpWith as $item) {
    if (is_string($item) && trim($item) !== '') {
        $helpLabels[] = trim(str_replace(["\r", "\n"], ' ', $item));
    }
}
if ($helpLabels === []) {
    respond(422, false, 'Please select at least one option.');
}

$body = implode("\r\n", [
    'New client onboarding agreement',
    '',
    'Full name: ' . $fullName,
    'ID or passport: ' . plain('id_passport'),
    'Email: ' . $email,
    'Phone: ' . plain('phone'),
    '',
    'Street address: ' . plain('street_address'),
    'Apartment: ' . plain('address_line'),
    'City: ' . plain('city'),
    'State / province: ' . plain('state'),
    'Postal code: ' . plain('postal'),
    'Country: ' . plain('country'),
    '',
    'Help with: ' . implode(', ', $helpLabels),
    '',
    'Company involved:',
    multiline('company_name'),
    '',
    'How they found the platform:',
    multiline('platform_discovery'),
    '',
    'How they were contacted:',
    multiline('contact_method'),
    '',
    'Loss details:',
    multiline('loss_details'),
    '',
    'Additional loss details:',
    multiline('additional_loss_details'),
    '',
    'Reported to authorities: ' . plain('reported_authorities'),
]);

$attachments = [];

if (preg_match('#^data:image/(png|jpeg|jpg|webp);base64,#i', $signature, $match) === 1) {
    $comma = strpos($signature, ',');
    $raw = $comma === false ? false : base64_decode(substr($signature, $comma + 1), true);
    if ($raw !== false && strlen($raw) > 0 && strlen($raw) <= 2000000) {
        $ext = strtolower($match[1]) === 'jpeg' ? 'jpg' : strtolower($match[1]);
        $attachments[] = [
            'name' => 'signature.' . $ext,
            'mime' => $ext === 'jpg' ? 'image/jpeg' : 'image/' . $ext,
            'data' => $raw,
        ];
    }
}

$allowed = [
    'jpg' => 'image/jpeg',
    'jpeg' => 'image/jpeg',
    'png' => 'image/png',
    'gif' => 'image/gif',
    'webp' => 'image/webp',
    'pdf' => 'application/pdf',
    'doc' => 'application/msword',
    'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'txt' => 'text/plain',
    'eml' => 'message/rfc822',
    'msg' => 'application/vnd.ms-outlook',
];

if (!empty($_FILES['evidence_files']['name']) && is_array($_FILES['evidence_files']['name'])) {
    $count = count($_FILES['evidence_files']['name']);
    for ($i = 0; $i < $count; $i++) {
        $error = (int) ($_FILES['evidence_files']['error'][$i] ?? UPLOAD_ERR_NO_FILE);
        if ($error === UPLOAD_ERR_NO_FILE) {
            continue;
        }
        if ($error !== UPLOAD_ERR_OK) {
            respond(422, false, 'One of the uploaded files could not be read.');
        }
        if ((int) ($_FILES['evidence_files']['size'][$i] ?? 0) > 8 * 1024 * 1024) {
            respond(422, false, 'One or more files exceed the 8 MB limit.');
        }
        $original = (string) ($_FILES['evidence_files']['name'][$i] ?? 'file');
        $ext = strtolower(pathinfo($original, PATHINFO_EXTENSION));
        if (!isset($allowed[$ext])) {
            respond(422, false, 'One of the files is not an allowed type.');
        }
        $tmp = (string) ($_FILES['evidence_files']['tmp_name'][$i] ?? '');
        $data = ($tmp !== '' && is_uploaded_file($tmp)) ? file_get_contents($tmp) : false;
        if ($data === false) {
            respond(422, false, 'One of the uploaded files could not be read.');
        }
        $safeName = preg_replace('/[^A-Za-z0-9._-]/', '_', basename($original));
        $attachments[] = [
            'name' => ($safeName !== null && $safeName !== '') ? $safeName : ('evidence-' . $i . '.' . $ext),
            'mime' => $allowed[$ext],
            'data' => $data,
        ];
    }
}

$boundary = 'bnd_' . bin2hex(random_bytes(12));
$fromName = (string) ($config['mail_from_name'] ?? 'GOin SAS');
$from = (string) $config['mail_from'];
$to = (string) $config['mail_to'];
$subject = '=?UTF-8?B?' . base64_encode('Client onboarding — ' . $fullName) . '?=';
$replyName = encode_name($fullName);

$headers = [
    'Date: ' . date('r'),
    'From: ' . encode_name($fromName) . ' <' . $from . '>',
    'To: <' . $to . '>',
    'Reply-To: ' . $replyName . ' <' . $email . '>',
    'Subject: ' . $subject,
    'MIME-Version: 1.0',
    'Content-Type: multipart/mixed; boundary="' . $boundary . '"',
];

$parts = '--' . $boundary . "\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: base64\r\n\r\n"
    . chunk_split(base64_encode($body), 76, "\r\n");

foreach ($attachments as $file) {
    $parts .= '--' . $boundary . "\r\n"
        . 'Content-Type: ' . $file['mime'] . '; name="' . $file['name'] . "\"\r\n"
        . "Content-Transfer-Encoding: base64\r\n"
        . 'Content-Disposition: attachment; filename="' . $file['name'] . "\"\r\n\r\n"
        . chunk_split(base64_encode($file['data']), 76, "\r\n");
}
$parts .= '--' . $boundary . "--\r\n";

try {
    smtp_send($config, implode("\r\n", $headers) . "\r\n\r\n" . $parts);
} catch (Throwable $error) {
    $detail = trim($error->getMessage());
    if ($detail === '' || stripos($detail, (string) $config['smtp_pass']) !== false) {
        $detail = 'The message could not be sent. Please try again.';
    }
    respond(502, false, $detail);
}

respond(200, true, 'Your agreement was submitted. We will be in touch by email.');
