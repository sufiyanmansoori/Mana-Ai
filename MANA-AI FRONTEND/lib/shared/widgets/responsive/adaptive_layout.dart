import 'package:flutter/widgets.dart';

import '../../../core/constants/layout_constants.dart';

abstract final class DeviceBreakpoints {
  static const double mobile = 600;
  static const double tablet = 900;
  static const double desktop = 1200;
  static const double ultrawide = 1920;
}

class ResponsiveBuilder extends StatelessWidget {
  const ResponsiveBuilder({
    required this.builder,
    super.key,
  });

  final Widget Function(
    BuildContext context,
    BoxConstraints constraints,
    DeviceScreenSize size,
  ) builder;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = constraints.maxWidth;
        final size = width < DeviceBreakpoints.mobile
            ? DeviceScreenSize.mobile
            : width < DeviceBreakpoints.tablet
                ? DeviceScreenSize.tablet
                : width < DeviceBreakpoints.desktop
                    ? DeviceScreenSize.laptop
                    : width < DeviceBreakpoints.ultrawide
                        ? DeviceScreenSize.desktop
                        : DeviceScreenSize.ultrawide;
        return builder(context, constraints, size);
      },
    );
  }
}

enum DeviceScreenSize {
  mobile,
  tablet,
  laptop,
  desktop,
  ultrawide,
}

class ResponsiveContent extends StatelessWidget {
  const ResponsiveContent({
    required this.child,
    this.maxWidth = LayoutConstants.maximumContentWidth,
    this.padding,
    super.key,
  });

  final Widget child;
  final double maxWidth;
  final EdgeInsetsGeometry? padding;

  @override
  Widget build(BuildContext context) {
    final width = MediaQuery.sizeOf(context).width;
    final horizontalPadding = width < DeviceBreakpoints.mobile ? 12.0 : 20.0;
    return Center(
      child: ConstrainedBox(
        constraints: BoxConstraints(maxWidth: maxWidth),
        child: Padding(
          padding:
              padding ?? EdgeInsets.symmetric(horizontal: horizontalPadding),
          child: child,
        ),
      ),
    );
  }
}

final class AdaptiveLayout extends StatelessWidget {
  const AdaptiveLayout({
    required this.compact,
    required this.expanded,
    this.medium,
    super.key,
  });

  final WidgetBuilder compact;
  final WidgetBuilder? medium;
  final WidgetBuilder expanded;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        if (constraints.maxWidth >= LayoutConstants.desktopBreakpoint) {
          return expanded(context);
        }
        if (constraints.maxWidth >= LayoutConstants.tabletBreakpoint) {
          return (medium ?? expanded)(context);
        }
        return compact(context);
      },
    );
  }
}
