import 'package:flutter/material.dart';

enum ComposerToolAction {
  addPhotosAndFiles,
  addFromLibrary,
  createImage,
  webSearch,
  deepResearch,
  sketch,
  thinking,
  manaAiPlatform,
  gmail,
}

class ComposerToolsMenu extends StatelessWidget {
  const ComposerToolsMenu({
    required this.onSelected,
    this.disabled = false,
    super.key,
  });

  final ValueChanged<ComposerToolAction> onSelected;
  final bool disabled;

  static const _items = <ComposerToolMenuItem>[
    ComposerToolMenuItem(
      action: ComposerToolAction.addPhotosAndFiles,
      icon: Icons.attach_file,
      label: 'Add photos & files',
    ),
    ComposerToolMenuItem(
      action: ComposerToolAction.addFromLibrary,
      icon: Icons.folder_outlined,
      label: 'Add from library',
    ),
    ComposerToolMenuItem(
      action: ComposerToolAction.createImage,
      icon: Icons.image_outlined,
      label: 'Create image',
    ),
    ComposerToolMenuItem(
      action: ComposerToolAction.webSearch,
      icon: Icons.travel_explore_outlined,
      label: 'Web search',
    ),
    ComposerToolMenuItem(
      action: ComposerToolAction.deepResearch,
      icon: Icons.science_outlined,
      label: 'Deep research',
    ),
    ComposerToolMenuItem(
      action: ComposerToolAction.sketch,
      icon: Icons.draw_outlined,
      label: 'Sketch',
    ),
    ComposerToolMenuItem(
      action: ComposerToolAction.thinking,
      icon: Icons.psychology_outlined,
      label: 'Thinking',
    ),
    ComposerToolMenuItem(
      action: ComposerToolAction.manaAiPlatform,
      icon: Icons.widgets_outlined,
      label: 'Mana AI Platform',
    ),
    ComposerToolMenuItem(
      action: ComposerToolAction.gmail,
      icon: Icons.mail_outline,
      label: 'Gmail',
      detail: 'Connect',
    ),
  ];

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 600;
    return IconButton(
      tooltip: 'Add tools',
      onPressed: disabled
          ? null
          : () {
              if (compact) {
                showModalBottomSheet<void>(
                  context: context,
                  useSafeArea: true,
                  isScrollControlled: true,
                  builder: (sheetContext) => SafeArea(
                    child: ConstrainedBox(
                      constraints: const BoxConstraints(maxHeight: 620),
                      child: ListView(
                        shrinkWrap: true,
                        padding: const EdgeInsets.fromLTRB(12, 8, 12, 18),
                        children: [
                          const SizedBox(
                            height: 28,
                            child: Center(
                              child: SizedBox(
                                width: 36,
                                height: 4,
                                child: DecoratedBox(
                                  decoration: BoxDecoration(
                                    color: Colors.grey,
                                    borderRadius:
                                        BorderRadius.all(Radius.circular(2)),
                                  ),
                                ),
                              ),
                            ),
                          ),
                          for (final item in _items)
                            ListTile(
                              leading: Icon(item.icon),
                              title: Text(item.label),
                              trailing: item.detail == null
                                  ? null
                                  : Text(
                                      item.detail!,
                                      style: Theme.of(sheetContext)
                                          .textTheme
                                          .labelMedium,
                                    ),
                              onTap: () {
                                Navigator.of(sheetContext).pop();
                                onSelected(item.action);
                              },
                            ),
                        ],
                      ),
                    ),
                  ),
                );
              } else {
                showMenu<ComposerToolAction>(
                  context: context,
                  position: const RelativeRect.fromLTRB(12, 420, 12, 12),
                  items: [
                    for (final item in _items)
                      PopupMenuItem<ComposerToolAction>(
                        value: item.action,
                        height: 48,
                        child: Row(
                          children: [
                            Icon(item.icon, size: 20),
                            const SizedBox(width: 12),
                            Expanded(child: Text(item.label)),
                            if (item.detail != null)
                              Text(
                                item.detail!,
                                style: Theme.of(context).textTheme.labelMedium,
                              ),
                          ],
                        ),
                      ),
                  ],
                ).then((action) {
                  if (action != null) onSelected(action);
                });
              }
            },
      icon: const Icon(Icons.add),
    );
  }
}

class ComposerToolMenuItem {
  const ComposerToolMenuItem({
    required this.action,
    required this.icon,
    required this.label,
    this.detail,
  });

  final ComposerToolAction action;
  final IconData icon;
  final String label;
  final String? detail;
}
