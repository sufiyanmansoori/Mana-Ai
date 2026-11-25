import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:mana_ai_app/core/l10n/generated/app_localizations.dart';
import 'package:mana_ai_app/features/chat/presentation/widgets/message_composer.dart';

void main() {
  for (final size in const [
    Size(320, 640),
    Size(360, 800),
    Size(390, 844),
    Size(600, 960),
    Size(768, 1024),
    Size(1280, 800),
    Size(1920, 1080),
  ]) {
    testWidgets(
        'composer has no horizontal overflow at ${size.width}x${size.height}',
        (tester) async {
      tester.view.physicalSize = size;
      tester.view.devicePixelRatio = 1;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        const MaterialApp(
          localizationsDelegates: AppLocalizations.localizationsDelegates,
          supportedLocales: [Locale('en')],
          home: Scaffold(
            body: Align(
              alignment: Alignment.bottomCenter,
              child: MessageComposer(
                onSend: null,
                onSendAsync: _sendUnused,
              ),
            ),
          ),
        ),
      );

      await tester.pump();
      expect(tester.takeException(), isNull);
      expect(find.byType(TextField), findsOneWidget);
    });
  }
}

Future<bool> _sendUnused(String content) async => true;
