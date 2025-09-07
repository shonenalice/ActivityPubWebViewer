<?php

/**
 * Validator Class
 * ActivityPubデータのバリデーション処理を担当
 */
class Validator
{
    /**
     * ActivityPub Actorオブジェクトの検証
     *
     * @param array $data
     * @return bool
     */
    public static function validateActorObject(array $data): bool
    {
        // 必須フィールドの存在確認
        $requiredFields = ['id', 'type', 'outbox'];
        foreach ($requiredFields as $field) {
            if (!isset($data[$field])) {
                return false;
            }
        }
        
        // typeがActorの種類であることを確認
        $validActorTypes = ['Person', 'Service', 'Organization', 'Application', 'Group'];
        if (!in_array($data['type'], $validActorTypes)) {
            return false;
        }
        
        // outboxがURLであることを確認
        if (!filter_var($data['outbox'], FILTER_VALIDATE_URL)) {
            return false;
        }
        
        return true;
    }

    /**
     * ActivityPub Noteオブジェクトの検証
     *
     * @param array $data
     * @return bool
     */
    public static function validateNoteObject(array $data): bool
    {
        // typeがNoteであることを確認
        if (!isset($data['type']) || $data['type'] !== 'Note') {
            return false;
        }
        
        // idフィールドの存在確認
        if (!isset($data['id']) || empty($data['id'])) {
            return false;
        }
        
        // contentまたはsummaryのいずれかが存在することを確認
        if (!isset($data['content']) && !isset($data['summary'])) {
            return false;
        }
        
        return true;
    }

    /**
     * outboxコレクションの検証（Misskey対応強化）
     *
     * @param array $data
     * @return bool
     */
    public static function validateOutboxCollection(array $data): bool
    {
        // typeがOrderedCollectionまたはCollectionであることを確認
        if (!isset($data['type'])) {
            return false;
        }
        
        $validTypes = ['OrderedCollection', 'Collection', 'OrderedCollectionPage', 'CollectionPage'];
        if (!in_array($data['type'], $validTypes)) {
            return false;
        }
        
        // orderedItems、items、またはfirstのいずれかが存在することを確認（Misskey対応）
        if (!isset($data['orderedItems']) && !isset($data['items']) && !isset($data['first'])) {
            return false;
        }
        
        return true;
    }

    /**
     * URLの形式とセキュリティチェックを行い、問題があれば例外を投げる
     *
     * @param string $url
     * @param array $allowedDomains
     * @return void
     * @throws FetchException
     */
    public static function validateUrl(string $url, array $allowedDomains = []): void
    {
        // 基本的なURL形式チェック
        if (!filter_var($url, FILTER_VALIDATE_URL)) {
            throw new FetchException('不正なURL形式です。', FetchException::INVALID_URL);
        }
        
        // HTTPSチェック
        if (!str_starts_with($url, 'https://')) {
            throw new FetchException('HTTPSのURLのみ対応しています。', FetchException::INVALID_URL);
        }
        
        // ドメイン制限チェック
        if (!empty($allowedDomains) && !in_array('*', $allowedDomains)) {
            $host = parse_url($url, PHP_URL_HOST);
            if (!$host || !in_array($host, $allowedDomains)) {
                throw new FetchException('許可されていないドメインです。', FetchException::DOMAIN_NOT_ALLOWED);
            }
        }
        
        // 危険なスキームの除外
        $scheme = parse_url($url, PHP_URL_SCHEME);
        $dangerousSchemes = ['javascript', 'data', 'vbscript', 'file'];
        if ($scheme && in_array(strtolower($scheme), $dangerousSchemes)) {
            throw new FetchException('許可されていないURLスキーマです。', FetchException::INVALID_URL);
        }
    }
}
