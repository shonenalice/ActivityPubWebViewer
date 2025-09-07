<?php

/**
 * ActivityPub Web Viewer API エンドポイント
 * フロントエンドからのリクエストを受け付け、ActivityPubデータを取得・提供
 */

// PHPクラスの読み込み
require_once 'php/FetchException.php';
require_once 'php/ParseException.php';
require_once 'php/Validator.php';
require_once 'php/SecurityHandler.php';
require_once 'php/Note.php';
require_once 'php/Client.php';
require_once 'php/ErrorResponse.php';

// セキュリティヘッダーとCORS設定
SecurityHandler::setSecurityHeaders();
SecurityHandler::setCorsHeaders();

try {
    // HTTPメソッドの確認
    if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
        ErrorResponse::output('INVALID_REQUEST', 'Only POST method is allowed', 405);
    }

    // JSON入力の取得と検証
    $jsonInput = file_get_contents('php://input');
    if (empty($jsonInput)) {
        ErrorResponse::output('JSON_ERROR', 'Empty request body');
    }

    // 入力データの検証とサニタイズ
    $requestData = SecurityHandler::validateJsonInput($jsonInput);
    
    // アクション処理
    if ($requestData['action'] === 'fetch_posts') {
        $actorUrl = trim($requestData['actor_url']);
        $maxPosts = isset($requestData['max_posts']) ? (int)$requestData['max_posts'] : 20;
        
        // 最大投稿数の制限
        $maxPosts = min(max($maxPosts, 1), 50); // 1-50の範囲に制限
        
        // ActivityPubクライアントの初期化
        $client = new Client(
            timeout: 10,
            allowedDomains: [] // 全ドメイン許可（必要に応じて制限可能）
        );
        
        // 投稿データの取得
        $result = $client->fetch($actorUrl, $maxPosts);
        
        // レスポンス用にデータを変換
        $responseData = [
            'posts' => array_map(fn($note) => $note->toArray(), $result['posts']),
            'actor_info' => $result['actor_info'],
            'meta' => $result['meta'],
            'debug_outbox_page' => $result['debug_outbox_page'] ?? null, // ★デバッグ情報を追加
            'debug_test' => $result['debug_test'] ?? null // ★テスト用
        ];
        
        // 成功レスポンス
        ErrorResponse::success($responseData);
        
    } else {
        ErrorResponse::output('INVALID_ACTION', 'Unsupported action');
    }

} catch (FetchException $e) {
    ErrorResponse::fromException($e);
} catch (ParseException $e) {
    ErrorResponse::fromException($e);
} catch (Exception $e) {
    // 予期しないエラーの場合、詳細を隠して安全なエラーメッセージを返す
    error_log('Unexpected error in api.php: ' . $e->getMessage());
    ErrorResponse::output('UNKNOWN_ERROR', 'An unexpected error occurred', 500);
}
