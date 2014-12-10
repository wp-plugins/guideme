<h2><?php _e( 'Export', 'guideme' ); ?></h2>
<form action="<?php get_site_url(); ?>/wp-admin/export.php" method="get" id="export-filters">
<input type="hidden" name="download" value="true" />
<input type="hidden" name="content" value="guideme" />
<p class="submit"><input type="submit" name="submit" id="submit" class="button button-primary" value="Download Export File"  /></p>
</form>
<h3><?php _e( 'Export to XML', 'guideme' ); ?></h3>
<p><?php _e( 'GuideMe will create a .xml export file which is compatible with the native WP import plugin.', 'guideme' ); ?></p>
<ol>
     <li><?php _e( 'Save the .xml file when prompted', 'guideme' ); ?></li>
     <li><?php _e( 'Navigate to Tools &raquo; Import and select WordPress', 'guideme' ); ?></li>
     <li><?php _e( 'Install WP import plugin if prompted', 'guideme' ); ?></li>
     <li><?php _e( 'Upload and import your exported .xml file', 'guideme' ); ?></li>
     <li><?php _e( 'Select your user and ignore Import Attachments', 'guideme' ); ?></li>
     <li><?php _e( 'That\'s it! Happy WordPressing', 'guideme' ); ?></li>
</ol>