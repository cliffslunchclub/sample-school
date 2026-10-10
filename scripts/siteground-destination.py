"""Resolve only a verified school document root; never modify remote files."""
import ftplib,io,json,os,ssl,socket
ftp=ftplib.FTP_TLS(context=ssl.create_default_context(),timeout=25)
ftp.connect(os.environ['FTP_SERVER'],int(os.environ.get('FTP_PORT','21')))
ftp.login(os.environ['FTP_USERNAME'],os.environ['FTP_PASSWORD']);ftp.prot_p()
configured=os.environ['FTP_DIR'];ftp.cwd(configured)
print('Configured FTP directory:',ftp.pwd())
print('FTP server address:',socket.gethostbyname(os.environ['FTP_SERVER']))
listing=ftp.nlst();print('Directory entries:',', '.join(sorted(listing)[:40]))
def release(folder):
    data=io.BytesIO()
    try:ftp.retrbinary('RETR '+folder.rstrip('/')+'/release.json',data.write);return json.loads(data.getvalue())
    except (ftplib.error_perm,ValueError):return None
school=os.environ['SCHOOL_SLUG'];domain='sampleschool' if school=='sample' else 'chs'
candidates=['public_html',domain+'.cliffslunchclub.com/public_html','www/'+domain+'.cliffslunchclub.com/public_html']
resolved=None
for folder in candidates:
    info=release(folder)
    if info and info.get('school_slug')==school:
        resolved=configured.rstrip('/')+'/'+folder+'/';print('Verified school document root:',resolved,'release:',info.get('version'));break
if resolved is None:
    info=release('.')
    if info and info.get('school_slug')==school:
        resolved=configured;print('Configured folder matches school release:',info.get('version'))
    else:raise SystemExit('Could not verify this FTP destination belongs to the expected school. Check its scoped document root.')
with open(os.environ['GITHUB_OUTPUT'],'a') as out:out.write('dir='+resolved+'\n')
try:ftp.quit()
except (OSError,EOFError):ftp.close()
