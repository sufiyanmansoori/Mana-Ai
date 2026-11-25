import 'dart:async';
import 'dart:convert';

import 'package:http/http.dart' as http;

import '../../../../core/config/api_endpoint.dart';
import '../../../../core/storage/secure_key_value_store.dart';

class SearchHistoryItem {
  const SearchHistoryItem({
    required this.id,
    required this.query,
    required this.searchType,
    required this.source,
    required this.status,
    required this.createdAt,
    required this.updatedAt,
  });

  final String id;
  final String query;
  final String searchType;
  final String source;
  final String status;
  final DateTime createdAt;
  final DateTime updatedAt;

  factory SearchHistoryItem.fromJson(Map<String, dynamic> json) {
    return SearchHistoryItem(
      id: json['id'] as String,
      query: json['query'] as String,
      searchType: json['searchType'] as String,
      source: json['source'] as String,
      status: json['status'] as String,
      createdAt: DateTime.parse(json['createdAt'] as String),
      updatedAt: DateTime.parse(json['updatedAt'] as String),
    );
  }
}

class SearchHistoryApiException implements Exception {
  const SearchHistoryApiException(this.message);
  final String message;
  @override
  String toString() => message;
}

class SearchHistoryApiDataSource {
  SearchHistoryApiDataSource({
    required ApiEndpoint endpoint,
    required http.Client client,
    required SecureKeyValueStore secureStorage,
  })  : _endpoint = endpoint,
        _client = client,
        _secureStorage = secureStorage;

  final ApiEndpoint _endpoint;
  final http.Client _client;
  final SecureKeyValueStore _secureStorage;

  Future<void> save({
    required String query,
    required String searchType,
    required String source,
    String? conversationId,
    String status = 'submitted',
    String? idempotencyKey,
  }) async {
    await _request(
      'POST',
      'v1/search-history',
      body: {
        'query': query.trim(),
        'searchType': searchType,
        'source': source,
        'status': status,
        if (conversationId != null) 'conversationId': conversationId,
        if (idempotencyKey != null) 'idempotencyKey': idempotencyKey,
      },
    );
  }

  Future<({List<SearchHistoryItem> items, int total})> list({
    required int page,
    required int limit,
    String? query,
  }) async {
    final parameters = <String, String>{
      'page': '$page',
      'limit': '$limit',
      if (query != null && query.trim().isNotEmpty) 'q': query.trim(),
    };
    final payload = await _request(
      'GET',
      'v1/search-history',
      queryParameters: parameters,
    );
    final data = payload['data'];
    if (data is! List<Object?>) {
      throw const SearchHistoryApiException(
        'The server returned an invalid search history.',
      );
    }
    final items = data
        .whereType<Map<Object?, Object?>>()
        .map(
          (item) => SearchHistoryItem.fromJson(
            item.map((key, value) => MapEntry(key.toString(), value)),
          ),
        )
        .toList(growable: false);
    final total = payload['total'];
    return (items: items, total: total is int ? total : items.length);
  }

  Future<void> deleteOne(String id) async {
    await _request('DELETE', 'v1/search-history/${Uri.encodeComponent(id)}');
  }

  Future<void> clearAll() async {
    await _request('DELETE', 'v1/search-history');
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, String>? queryParameters,
    Map<String, Object?>? body,
  }) async {
    final token = _secureStorage.readAccessTokenSync() ??
        await _secureStorage.read('auth.access_token');
    if (token == null || token.trim().isEmpty) {
      throw const SearchHistoryApiException(
        'Sign in to Mana AI to synchronize search history.',
      );
    }
    var uri = _endpoint.resolve(path);
    if (queryParameters != null && queryParameters.isNotEmpty) {
      uri = uri.replace(queryParameters: queryParameters);
    }
    http.Response response;
    try {
      final request = http.Request(method, uri)
        ..headers.addAll({
          'accept': 'application/json',
          'authorization': 'Bearer ${token.trim()}',
          if (body != null) 'content-type': 'application/json',
        });
      if (body != null) request.body = jsonEncode(body);
      final streamed = await _client.send(request).timeout(
            const Duration(seconds: 12),
          );
      response = await http.Response.fromStream(streamed).timeout(
        const Duration(seconds: 12),
      );
    } on TimeoutException {
      throw const SearchHistoryApiException(
        'Search history timed out. Please retry.',
      );
    } on http.ClientException {
      throw const SearchHistoryApiException(
        'Search history could not be reached.',
      );
    }
    if (response.statusCode == 204) return const {};
    Map<String, dynamic> payload;
    try {
      final decoded = jsonDecode(response.body);
      payload = decoded is Map<String, dynamic> ? decoded : const {};
    } on FormatException {
      throw const SearchHistoryApiException(
        'The server returned an invalid search history response.',
      );
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      final error = payload['error'];
      throw SearchHistoryApiException(
        error is Map<String, dynamic> && error['message'] is String
            ? error['message'] as String
            : 'Search history request failed.',
      );
    }
    return payload;
  }
}
