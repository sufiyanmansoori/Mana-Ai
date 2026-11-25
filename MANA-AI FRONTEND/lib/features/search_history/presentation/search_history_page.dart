import 'package:flutter/material.dart';

import '../data/search_history_api_data_source.dart';

class SearchHistoryPage extends StatefulWidget {
  const SearchHistoryPage({
    required this.dataSource,
    required this.onRepeat,
    super.key,
  });

  final SearchHistoryApiDataSource dataSource;
  final ValueChanged<String> onRepeat;

  @override
  State<SearchHistoryPage> createState() => _SearchHistoryPageState();
}

class _SearchHistoryPageState extends State<SearchHistoryPage> {
  final _searchController = TextEditingController();
  final _items = <SearchHistoryItem>[];
  bool _loading = true;
  bool _loadingMore = false;
  bool _hasMore = true;
  String? _error;
  int _page = 1;

  @override
  void initState() {
    super.initState();
    _load(refresh: true);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({required bool refresh}) async {
    if (refresh) {
      setState(() {
        _loading = true;
        _error = null;
        _page = 1;
      });
    } else {
      setState(() => _loadingMore = true);
    }
    try {
      final result = await widget.dataSource.list(
        page: _page,
        limit: 30,
        query: _searchController.text,
      );
      if (!mounted) return;
      setState(() {
        if (refresh) _items.clear();
        _items.addAll(result.items);
        _hasMore = _items.length < result.total;
        _page++;
        _loading = false;
        _loadingMore = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error is SearchHistoryApiException
            ? error.message
            : 'Search history could not be loaded.';
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  Future<void> _deleteOne(SearchHistoryItem item) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete search history?'),
        content: Text('Remove “${item.query}” from your history?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Delete'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _items.remove(item));
    try {
      await widget.dataSource.deleteOne(item.id);
    } catch (_) {
      if (!mounted) return;
      setState(() => _items.insert(0, item));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not delete that search.')),
      );
    }
  }

  Future<void> _clearAll() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Clear all search history?'),
        content: const Text(
          'This permanently deletes all of your saved Mana AI search history.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Clear all'),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    final previous = List<SearchHistoryItem>.of(_items);
    setState(() => _items.clear());
    try {
      await widget.dataSource.clearAll();
    } catch (_) {
      if (!mounted) return;
      setState(() => _items.addAll(previous));
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not clear search history.')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < 600;
        return Column(
          children: [
            Padding(
              padding: EdgeInsets.fromLTRB(
                compact ? 12 : 24,
                12,
                compact ? 12 : 24,
                8,
              ),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 960),
                child: Row(
                  children: [
                    Expanded(
                      child: TextField(
                        controller: _searchController,
                        onSubmitted: (_) => _load(refresh: true),
                        decoration: const InputDecoration(
                          hintText: 'Search history',
                          prefixIcon: Icon(Icons.search),
                          isDense: true,
                        ),
                      ),
                    ),
                    const SizedBox(width: 8),
                    IconButton(
                      tooltip: 'Clear all history',
                      onPressed: _items.isEmpty ? null : _clearAll,
                      icon: const Icon(Icons.delete_sweep_outlined),
                    ),
                  ],
                ),
              ),
            ),
            Expanded(
              child: _loading
                  ? const Center(child: CircularProgressIndicator())
                  : _error != null
                      ? Center(
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxWidth: 420),
                            child: Column(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(_error!, textAlign: TextAlign.center),
                                const SizedBox(height: 12),
                                FilledButton(
                                  onPressed: () => _load(refresh: true),
                                  child: const Text('Retry'),
                                ),
                              ],
                            ),
                          ),
                        )
                      : _items.isEmpty
                          ? const Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.history, size: 42),
                                  SizedBox(height: 12),
                                  Text('No search history'),
                                ],
                              ),
                            )
                          : Center(
                              child: ConstrainedBox(
                                constraints:
                                    const BoxConstraints(maxWidth: 960),
                                child: ListView.builder(
                                  padding: EdgeInsets.fromLTRB(
                                    compact ? 12 : 24,
                                    8,
                                    compact ? 12 : 24,
                                    24,
                                  ),
                                  itemCount: _items.length + (_hasMore ? 1 : 0),
                                  itemBuilder: (context, index) {
                                    if (index == _items.length) {
                                      if (!_loadingMore) {
                                        WidgetsBinding.instance
                                            .addPostFrameCallback((_) {
                                          if (mounted &&
                                              _hasMore &&
                                              !_loadingMore) {
                                            _load(refresh: false);
                                          }
                                        });
                                      }
                                      return const Padding(
                                        padding: EdgeInsets.all(16),
                                        child: Center(
                                          child: CircularProgressIndicator(),
                                        ),
                                      );
                                    }
                                    final item = _items[index];
                                    return Card(
                                      margin: const EdgeInsets.only(bottom: 8),
                                      color: scheme.surfaceContainerLow,
                                      child: ListTile(
                                        title: Text(
                                          item.query,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        subtitle: Text(
                                          '${item.searchType} · ${_formatDate(item.createdAt)}',
                                        ),
                                        trailing: PopupMenuButton<String>(
                                          onSelected: (value) {
                                            if (value == 'repeat') {
                                              widget.onRepeat(item.query);
                                            }
                                            if (value == 'delete') {
                                              _deleteOne(item);
                                            }
                                          },
                                          itemBuilder: (context) => const [
                                            PopupMenuItem(
                                              value: 'repeat',
                                              child: Text('Open / repeat'),
                                            ),
                                            PopupMenuItem(
                                              value: 'delete',
                                              child: Text('Delete'),
                                            ),
                                          ],
                                        ),
                                        onTap: () =>
                                            widget.onRepeat(item.query),
                                      ),
                                    );
                                  },
                                ),
                              ),
                            ),
            ),
          ],
        );
      },
    );
  }

  String _formatDate(DateTime date) {
    final local = date.toLocal();
    final y = local.year.toString().padLeft(4, '0');
    final m = local.month.toString().padLeft(2, '0');
    final d = local.day.toString().padLeft(2, '0');
    final h = local.hour.toString().padLeft(2, '0');
    final minute = local.minute.toString().padLeft(2, '0');
    return '$y-$m-$d $h:$minute';
  }
}
