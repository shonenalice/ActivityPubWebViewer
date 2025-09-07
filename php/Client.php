<?php

/**
 * MiniActPubClient - ActivityPubライブラリのメインクラス
 * 指定されたActivityPubのActor URLから公開投稿（outbox）を取得し、
 * アプリケーションで扱いやすい形式のオブジェクトに変換して提供する
 */
class Client
{
    /**
     * @var int HTTPリクエストのタイムアウト秒数
     */
    private int $timeout;

    /**
     * @var array HTTPリクエストヘッダー
     */
    private array $httpHeaders;

    /**
     * @var array 許可されたドメインリスト（空の場合は全て許可）
     */
    private array $allowedDomains;

    /**
     * コンストラクタ
     * @param int $timeout HTTPタイムアウト（秒）
     * @param array $allowedDomains 許可ドメインリスト
     */
    public function __construct(int $timeout = 10, array $allowedDomains = [])
    {
        $this->timeout = $timeout;
        $this->allowedDomains = $allowedDomains;
        $this->httpHeaders = [
            'Accept: application/activity+json, application/ld+json; profile="https://www.w3.org/ns/activitystreams"',
            'User-Agent: ActivityPubWebViewer/1.0 (+https://yourdomain.com/about)',
            'Accept-Language: ja,en;q=0.9',
            'Cache-Control: no-cache'
        ];
    }

    /**
     * 指定されたActorの公開投稿を取得する
     *
     * @param string $actorUrl ActorのURL (例: https://mastodon.social/users/Gargron)
     * @param int $maxPosts 取得する最大投稿数
     * @return array 取得結果 ['posts' => Note[], 'actor_info' => array, 'meta' => array, 'debug_unparsed' => array]
     * @throws FetchException データ取得に失敗した場合
     * @throws ParseException パースに失敗した場合
     */
    public function fetch(string $actorUrl, int $maxPosts = 20): array
    {
        // ★解析失敗アイテムを格納するデバッグ用配列
        $debug_unparsed_items = [];
        // 1. URLバリデーション (Validatorに一元化)
        Validator::validateUrl($actorUrl, $this->allowedDomains);
        
        // 2. Actorオブジェクトを取得
        $actorJson = $this->httpGet($actorUrl);
        
        // 3. Actorデータのバリデーション
        if (!Validator::validateActorObject($actorJson)) {
            throw new ParseException('有効なActivityPub Actorではありません。', ParseException::INVALID_ACTOR);
        }
        
        // 4. outboxのURLを取得
        $outboxUrl = $actorJson['outbox'] ?? null;
        if (!$outboxUrl) {
            throw new ParseException('outboxのURLが見つかりません。', ParseException::NO_OUTBOX);
        }

        // 5. outboxのコレクションを取得
        $outboxCollection = $this->httpGet($outboxUrl);
        
        // 5.1. outboxが直接アイテムリストを持たず、'first'ページへのリンクだけを持つ場合に対応
        if (isset($outboxCollection['first']) && is_string($outboxCollection['first'])) {
            // 'first'ページのURLから、実際のアイテムが含まれるページを取得する
            $outboxPage = $this->httpGet($outboxCollection['first']);
        } else {
            // 'first'がない場合は、このオブジェクト自体がアイテムページだと判断
            $outboxPage = $outboxCollection;
        }
        
        // 5.2. アイテムが含まれるはずのページ（$outboxPage）に対して検証を実行
        if (!Validator::validateOutboxCollection($outboxPage)) {
            // ここで検証が失敗する場合、サーバーの応答が予期せぬ形式である
            throw new ParseException('有効なoutboxコレクションではありません。', ParseException::INVALID_NOTE);
        }

        // 7. 投稿データの取得（ページネーション対応）
        $extractResult = $this->extractNotesFromOutbox($outboxPage, $maxPosts, $debug_unparsed_items);
        $notes = $extractResult['notes'];
        $debug_unparsed_items = $extractResult['debug_unparsed'];
        
        // 8. Actor情報を抽出
        $actorInfo = $this->extractActorInfo($actorJson);
        
        // 9. メタ情報を生成
        $meta = [
            'count' => count($notes),
            'fetched_at' => date('c'),
            'actor_url' => $actorUrl,
            'outbox_url' => $outboxUrl
        ];
        
        return [
            'posts' => $notes,
            'actor_info' => $actorInfo,
            'meta' => $meta,
            'debug_outbox_page' => $outboxPage, // ★★★ outboxページの中身を直接確認 ★★★
            'debug_test' => 'THIS_IS_A_TEST_' . date('H:i:s') // ★テスト用
        ];
    }

    /**
     * outboxから投稿データを抽出（Mastodon・Misskey対応）
     *
     * @param array $outboxJson
     * @param int $maxPosts
     * @param array &$debug_unparsed_items 解析失敗アイテム格納用
     * @return array ['notes' => Note[], 'debug_unparsed' => array]
     * @throws FetchException
     * @throws ParseException
     */
    private function extractNotesFromOutbox(array $outboxJson, int $maxPosts, array &$debug_unparsed_items): array
    {
        // ===== デバッグ開始 =====
        error_log('DEBUG: outboxJson keys: ' . implode(', ', array_keys($outboxJson)));
        error_log('DEBUG: outboxJson type: ' . ($outboxJson['type'] ?? 'not set'));
        
        if (isset($outboxJson['orderedItems'])) {
            error_log('DEBUG: orderedItems count: ' . count($outboxJson['orderedItems']));
        } 
        if (isset($outboxJson['items'])) {
            error_log('DEBUG: items count: ' . count($outboxJson['items']));
        }
        if (isset($outboxJson['first'])) {
            error_log('DEBUG: first URL: ' . (is_string($outboxJson['first']) ? $outboxJson['first'] : json_encode($outboxJson['first'])));
        }
        // ===== デバッグ終了 =====
        
        $notes = [];
        $processedCount = 0;
        
        // 直接orderedItemsがある場合（最初のページ）
        if (isset($outboxJson['orderedItems']) && is_array($outboxJson['orderedItems'])) {
            $processResult = $this->processOrderedItems($outboxJson['orderedItems'], $maxPosts, $processedCount, $debug_unparsed_items);
            $notes = array_merge($notes, $processResult['notes']);
        }
        // itemsがある場合（Misskey等で使用されることがある）
        else if (isset($outboxJson['items']) && is_array($outboxJson['items'])) {
            $processResult = $this->processOrderedItems($outboxJson['items'], $maxPosts, $processedCount, $debug_unparsed_items);
            $notes = array_merge($notes, $processResult['notes']);
        }
        // orderedItemsもitemsもない場合、firstページを確認
        else if (isset($outboxJson['first'])) {
            $firstPageUrl = is_string($outboxJson['first']) ? $outboxJson['first'] : $outboxJson['first']['id'] ?? null;
            error_log('DEBUG: Accessing first page: ' . $firstPageUrl);
            
            if ($firstPageUrl) {
                $firstPageJson = $this->httpGet($firstPageUrl);
                error_log('DEBUG: First page keys: ' . implode(', ', array_keys($firstPageJson)));
                
                // firstページでorderedItemsまたはitemsを確認
                if (isset($firstPageJson['orderedItems']) && is_array($firstPageJson['orderedItems'])) {
                    error_log('DEBUG: First page orderedItems count: ' . count($firstPageJson['orderedItems']));
                    $processResult = $this->processOrderedItems($firstPageJson['orderedItems'], $maxPosts, $processedCount, $debug_unparsed_items);
                    $notes = array_merge($notes, $processResult['notes']);
                } else if (isset($firstPageJson['items']) && is_array($firstPageJson['items'])) {
                    error_log('DEBUG: First page items count: ' . count($firstPageJson['items']));
                    $processResult = $this->processOrderedItems($firstPageJson['items'], $maxPosts, $processedCount, $debug_unparsed_items);
                    $notes = array_merge($notes, $processResult['notes']);
                } else {
                    error_log('DEBUG: First page has no orderedItems or items');
                }
            }
        } else {
            error_log('DEBUG: No orderedItems, items, or first found in outbox');
        }
        
        error_log('DEBUG: Final result - extracted ' . count($notes) . ' notes');
        error_log('DEBUG: Unparsed items count: ' . count($debug_unparsed_items));
        
        return [
            'notes' => $notes,
            'debug_unparsed' => $debug_unparsed_items
        ];
    }

    /**
     * orderedItemsの配列を処理してNoteオブジェクトに変換
     *
     * @param array $orderedItems
     * @param int $maxPosts
     * @param int &$processedCount
     * @param array &$debug_unparsed_items 解析失敗アイテム格納用
     * @return array ['notes' => Note[], 'debug_unparsed' => array]
     */
    private function processOrderedItems(array $orderedItems, int $maxPosts, int &$processedCount, array &$debug_unparsed_items): array
    {
        error_log('DEBUG: Processing ' . count($orderedItems) . ' items, maxPosts=' . $maxPosts . ', processedCount=' . $processedCount);
        
        $notes = [];
        
        foreach ($orderedItems as $index => $item) {
            if ($processedCount >= $maxPosts) break;
            
            error_log('DEBUG: Item ' . $index . ' type: ' . (is_array($item) ? ($item['type'] ?? 'no type') : gettype($item)));
            
            $noteObject = null;
            $parsedSuccessfully = false; // ★解析成功フラグ
            
            // ★★★ Announce アクティビティの場合（Misskey対応）★★★
            if (isset($item['type']) && $item['type'] === 'Announce' && isset($item['object'])) {
                error_log('DEBUG: Found Announce activity (Misskey boost/renote)');
                
                // objectがURL文字列の場合、そのURLから投稿データを取得
                if (is_string($item['object']) && filter_var($item['object'], FILTER_VALIDATE_URL)) {
                    error_log('DEBUG: Announce activity with object URL: ' . $item['object']);
                    try {
                        // 元の投稿データを取得
                        $originalPost = $this->httpGet($item['object']);
                        
                        // 取得した投稿がNote形式かチェック
                        if (isset($originalPost['type']) && $originalPost['type'] === 'Note') {
                            error_log('DEBUG: Successfully fetched Note from Announce object URL');
                            $noteObject = $originalPost;
                        } else {
                            error_log('DEBUG: Fetched object is not a Note: ' . ($originalPost['type'] ?? 'unknown type'));
                        }
                    } catch (Exception $e) {
                        error_log('DEBUG: Failed to fetch Announce object from URL: ' . $e->getMessage());
                        $noteObject = null;
                    }
                } else {
                    error_log('DEBUG: Announce activity with non-URL object: ' . gettype($item['object']));
                }
            }
            // Create Activityの場合（従来の処理）
            else if (isset($item['type']) && $item['type'] === 'Create' && isset($item['object'])) {
                // objectが配列（投稿オブジェクト）か、文字列（投稿へのURL）かをチェック
                if (is_array($item['object'])) {
                    // オブジェクトが直接含まれる場合
                    error_log('DEBUG: Create activity with direct object (array)');
                    $noteObject = $item['object'];
                } elseif (is_string($item['object']) && filter_var($item['object'], FILTER_VALIDATE_URL)) {
                    // URLの場合、そのURLから投稿データを再取得する
                    error_log('DEBUG: Create activity with object URL: ' . $item['object']);
                    try {
                        $noteObject = $this->httpGet($item['object']);
                        error_log('DEBUG: Successfully fetched note from Create URL');
                    } catch (Exception $e) {
                        // 1件の取得失敗で全体が止まらないように、失敗時はスキップ
                        error_log('DEBUG: Failed to fetch note from Create URL: ' . $e->getMessage());
                        $noteObject = null;
                    }
                } else {
                    error_log('DEBUG: Create activity with invalid object type: ' . gettype($item['object']));
                }
            }
            // 直接Noteオブジェクトの場合
            else if (isset($item['type']) && $item['type'] === 'Note') {
                $noteObject = $item;
            }
            // ActivityがURL参照の場合（稀）
            else if (is_string($item) && filter_var($item, FILTER_VALIDATE_URL)) {
                try {
                    $activityJson = $this->httpGet($item);
                    if (isset($activityJson['type']) && $activityJson['type'] === 'Create' && isset($activityJson['object'])) {
                        $noteObject = $activityJson['object'];
                    }
                } catch (Exception $e) {
                    // URL取得に失敗した場合はスキップ
                    continue;
                }
            }
            
            // Noteオブジェクトを処理
            if ($noteObject && Validator::validateNoteObject($noteObject)) {
                error_log('DEBUG: Valid note found, creating Note object');
                $notes[] = Note::fromArray($noteObject);
                $processedCount++;
                $parsedSuccessfully = true; // ★成功フラグを立てる
            } else {
                if ($noteObject) {
                    error_log('DEBUG: Note validation failed for item ' . $index);
                    // ★★★ デバッグ用：バリデーション失敗したNoteの詳細をログ出力 ★★★
                    error_log('DEBUG: Failed note structure: ' . json_encode($noteObject, JSON_UNESCAPED_UNICODE));
                } else {
                    error_log('DEBUG: No note object extracted from item ' . $index);
                }
            }
            
            // ★もし解析に失敗していたら、元のアイテムをデバッグ用に保存
            if (!$parsedSuccessfully) {
                $debug_unparsed_items[] = $item;
                error_log('DEBUG: Added unparsed item ' . $index . ' to debug array');
            }
        }
        
        return [
            'notes' => $notes,
            'debug_unparsed' => $debug_unparsed_items
        ];
    }

    /**
     * HTTP GETリクエストを実行し、結果をJSONデコードして返す (cURL実装)
     *
     * @param string $url
     * @return array
     * @throws FetchException
     * @throws ParseException
     */
    private function httpGet(string $url): array
    {
        $ch = curl_init();
        curl_setopt($ch, CURLOPT_URL, $url);
        curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
        curl_setopt($ch, CURLOPT_HTTPHEADER, $this->httpHeaders);
        curl_setopt($ch, CURLOPT_TIMEOUT, $this->timeout);
        curl_setopt($ch, CURLOPT_FOLLOWLOCATION, true); // リダイレクトを追跡
        curl_setopt($ch, CURLOPT_MAXREDIRS, 5);
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, true); // SSL証明書検証
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 2);

        $response = curl_exec($ch);
        $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);

        if (curl_errno($ch)) {
            $error = curl_error($ch);
            curl_close($ch);
            throw new FetchException("cURL Error: {$error}", FetchException::NETWORK_ERROR);
        }
        
        curl_close($ch);

        if ($httpCode < 200 || $httpCode >= 300) {
            throw new FetchException("HTTPエラー: {$httpCode}", FetchException::HTTP_ERROR);
        }

        $decodedData = json_decode($response, true);
        if (json_last_error() !== JSON_ERROR_NONE) {
            throw new ParseException('JSONの解析に失敗しました: ' . json_last_error_msg(), ParseException::JSON_ERROR);
        }

        return $decodedData;
    }

    /**
     * Actorオブジェクトから基本情報を抽出
     *
     * @param array $actorData
     * @return array
     */
    private function extractActorInfo(array $actorData): array
    {
        return [
            'id' => $actorData['id'] ?? '',
            'name' => $actorData['name'] ?? $actorData['preferredUsername'] ?? 'Unknown',
            'preferredUsername' => $actorData['preferredUsername'] ?? '',
            'summary' => strip_tags($actorData['summary'] ?? ''),
            'url' => $actorData['url'] ?? '',
            'avatar' => $actorData['icon']['url'] ?? null,
            'header' => $actorData['image']['url'] ?? null,
            'followers_count' => $actorData['followers'] ?? 0,
            'following_count' => $actorData['following'] ?? 0
        ];
    }
}
